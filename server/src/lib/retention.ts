/**
 * CLOUD - retention lifecycle for deleted journal content.
 *
 * Full records are moved out of the active journal namespace immediately,
 * then reduced to a minimal cryptographic record after the retention window.
 * The active entry keeps a tombstone so the append-only hash chain remains
 * linkable without retaining the user's journal text in the visible record.
 */
import { createHash, createHmac } from "crypto";
import {
  DocumentReference,
  Timestamp,
  WriteBatch,
  getFirestore,
} from "firebase-admin/firestore";
import { recordAuditEvent } from "./audit";

export const RETENTION_DAYS = 30;
export const RETENTION_ENTRIES = "retentionEntries";
export const RETENTION_TURNS = "retentionTurns";
export const REDACTED_VALUE = "Deleted";
const MAX_BATCH_OPERATIONS = 400;

export interface ArchiveResult {
  found: boolean;
  archived: boolean;
  alreadyDeleted: boolean;
  redactAt?: Timestamp;
}

function actorHash(uid: string): string {
  const configuredSecret = process.env.DELETION_HMAC_KEY;
  if (configuredSecret) {
    return createHmac("sha256", configuredSecret).update(uid).digest("hex");
  }
  // Local fallback keeps development usable. Production should configure the HMAC secret.
  return createHash("sha256").update(`local-only:${uid}`).digest("hex");
}

export function hashDeletionActor(uid: string): string {
  return actorHash(uid);
}

export function retentionDeadline(now = Date.now()): Timestamp {
  return Timestamp.fromMillis(now + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function buildEntryTombstone(
  uid: string,
  original: Record<string, unknown>,
  deletedAt: Timestamp,
  redactAt: Timestamp
): Record<string, unknown> {
  return {
    uid,
    clientRequestId: typeof original.clientRequestId === "string" ? original.clientRequestId : null,
    createdAt: typeof original.createdAt === "string" ? original.createdAt : null,
    prevHash: typeof original.prevHash === "string" ? original.prevHash : null,
    hash: typeof original.hash === "string" ? original.hash : null,
    deletionState: "deleted",
    deletedAt,
    redactAt,
    deletedByUidHash: actorHash(uid),
  };
}

export function buildRedactedEntry(
  uid: string,
  entryId: string,
  original: Record<string, unknown>,
  redactedAt: Timestamp
): Record<string, unknown> {
  return {
    uid,
    entryId,
    createdAt: typeof original.createdAt === "string" ? original.createdAt : null,
    deletedAt: original.deletedAt ?? null,
    redactedAt,
    deletedByUidHash: typeof original.deletedByUidHash === "string" ? original.deletedByUidHash : null,
    prevHash: typeof original.prevHash === "string" ? original.prevHash : null,
    hash: typeof original.hash === "string" ? original.hash : null,
    retentionState: "redacted",
    content: REDACTED_VALUE,
    reflection: REDACTED_VALUE,
    summary: REDACTED_VALUE,
    topics: [],
    piiDetected: [],
  };
}

export function buildRedactedTurn(
  uid: string,
  entryId: string,
  turnId: string,
  original: Record<string, unknown>,
  redactedAt: Timestamp
): Record<string, unknown> {
  return {
    uid,
    entryId,
    turnId,
    role: original.role === "model" ? "model" : "user",
    createdAt: typeof original.createdAt === "string" ? original.createdAt : null,
    deletedAt: original.deletedAt ?? null,
    redactedAt,
    prevHash: typeof original.prevHash === "string" ? original.prevHash : null,
    hash: typeof original.hash === "string" ? original.hash : null,
    retentionState: "redacted",
    text: REDACTED_VALUE,
  };
}

async function commitInChunks(
  operations: Array<(batch: WriteBatch) => void>
): Promise<void> {
  const db = getFirestore();
  for (let offset = 0; offset < operations.length; offset += MAX_BATCH_OPERATIONS) {
    const batch = db.batch();
    operations.slice(offset, offset + MAX_BATCH_OPERATIONS).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

function uidFromRetentionRef(ref: DocumentReference): string | null {
  return ref.parent.parent?.id ?? null;
}

async function deleteActiveConversation(uid: string, entryId: string): Promise<void> {
  const db = getFirestore();
  const conversationRef = db.collection(`users/${uid}/entries/${entryId}/conversation`);
  const snap = await conversationRef.get();
  if (snap.empty) return;

  await commitInChunks(snap.docs.map((turn) => (batch) => batch.delete(turn.ref)));
}

export async function archiveAndTombstoneEntry(
  uid: string,
  entryId: string,
  now = Date.now()
): Promise<ArchiveResult> {
  const db = getFirestore();
  const entryRef = db.doc(`users/${uid}/entries/${entryId}`);
  const entrySnap = await entryRef.get();

  if (!entrySnap.exists) {
    return { found: false, archived: false, alreadyDeleted: false };
  }

  const original = entrySnap.data() as Record<string, unknown>;
  const alreadyDeleted = original.deletionState === "deleted";
  const retentionRef = db.doc(`users/${uid}/${RETENTION_ENTRIES}/${entryId}`);
  const deletedAt = original.deletedAt instanceof Timestamp
    ? original.deletedAt
    : Timestamp.fromMillis(now);
  const redactAt = original.redactAt instanceof Timestamp
    ? original.redactAt
    : retentionDeadline(deletedAt.toMillis());

  if (alreadyDeleted) {
    return { found: true, archived: false, alreadyDeleted: true, redactAt };
  }

  // Lock first so a concurrent reply observes `deleting` and fails before it
  // can write a turn that would miss the archive snapshot.
  if (original.deletionState !== "deleting") {
    await db.runTransaction(async (tx) => {
      const latest = await tx.get(entryRef);
      if (!latest.exists || latest.data()?.deletionState === "deleted") return;
      if (latest.data()?.deletionState === "deleting") return;
      tx.set(entryRef, {
        ...latest.data(),
        deletionState: "deleting",
        deletedAt,
        redactAt,
        deletedByUidHash: actorHash(uid),
      });
    });
  }

  const deletingSnap = await entryRef.get();
  if (!deletingSnap.exists) return { found: false, archived: false, alreadyDeleted: false };
  const deletingEntry = deletingSnap.data() as Record<string, unknown>;
  if (deletingEntry.deletionState === "deleted") {
    return { found: true, archived: false, alreadyDeleted: true, redactAt };
  }

  const conversationSnap = await entryRef.collection("conversation").get();
  const archiveOperations: Array<(batch: WriteBatch) => void> = [
    (batch) =>
      batch.set(retentionRef, {
        ...deletingEntry,
        entryId,
        retentionState: "pending_redaction",
        deletedAt,
        redactAt,
        deletedByUidHash: actorHash(uid),
      }),
    ...conversationSnap.docs.map((turn) => {
      const turnRef = db.doc(`users/${uid}/${RETENTION_TURNS}/${entryId}__${turn.id}`);
      return (batch: WriteBatch) =>
        batch.set(turnRef, {
          ...turn.data(),
          uid,
          entryId,
          turnId: turn.id,
          retentionState: "pending_redaction",
          deletedAt,
          redactAt,
          deletedByUidHash: actorHash(uid),
        });
    }),
  ];
  await commitInChunks(archiveOperations);

  const tombstone = buildEntryTombstone(uid, deletingEntry, deletedAt, redactAt);
  await db.runTransaction(async (tx) => {
    const latest = await tx.get(entryRef);
    if (!latest.exists || latest.data()?.deletionState === "deleted") return;
    tx.set(entryRef, tombstone);
  });

  // This is idempotent cleanup for retries and also removes any turn that
  // raced with the archive. Rules hide the subcollection meanwhile.
  await deleteActiveConversation(uid, entryId);

  return {
    found: true,
    archived: true,
    alreadyDeleted: false,
    redactAt,
  };
}

export async function redactExpiredRetention(limit = 50): Promise<{
  processed: number;
  redacted: number;
  skipped: number;
}> {
  const db = getFirestore();
  const now = Timestamp.now();
  const dueEntries = await db
    .collectionGroup(RETENTION_ENTRIES)
    .where("redactAt", "<=", now)
    .limit(limit)
    .get();

  let processed = 0;
  let redacted = 0;
  let skipped = 0;

  for (const entryDoc of dueEntries.docs) {
    processed += 1;
    const uid = uidFromRetentionRef(entryDoc.ref);
    if (!uid) {
      skipped += 1;
      continue;
    }

    const original = entryDoc.data() as Record<string, unknown>;
    if (original.retentionState === "redacted") {
      skipped += 1;
      continue;
    }

    const redactedAt = Timestamp.now();
    const turnsSnap = await db
      .collection(`users/${uid}/${RETENTION_TURNS}`)
      .where("entryId", "==", entryDoc.id)
      .get();

    // Redact turns first. If the parent update fails, a retry can safely
    // repeat these idempotent writes and finish the parent record.
    const turnOperations = turnsSnap.docs.map((turn) => {
      const redactedTurn = buildRedactedTurn(uid, entryDoc.id, turn.id, turn.data(), redactedAt);
      return (batch: WriteBatch) => batch.set(turn.ref, redactedTurn);
    });
    await commitInChunks(turnOperations);
    await entryDoc.ref.set(buildRedactedEntry(uid, entryDoc.id, original, redactedAt));

    await recordAuditEvent(uid, "entry_redacted", "success", {
      entryId: entryDoc.id,
      retentionDays: RETENTION_DAYS,
    }).catch(() => undefined);

    redacted += 1;
  }

  return { processed, redacted, skipped };
}
