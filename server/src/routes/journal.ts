/**
 * CLOUD — deploys inside the Cloud Run container.
 *
 * Every route here assumes requireAuth has already run (mounted in
 * server/src/index.ts) — req.uid is always the verified caller's uid,
 * never a client-supplied field.
 */

import { Router, Response } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { AuthedRequest } from "../middleware/auth";
import { scanForSensitiveContent, redact } from "../lib/piiDetector";
import { analyzeEntry, continueConversation, ConversationTurn } from "../lib/geminiClient";
import { enforceRateLimit, RateLimitError, enforceTokenBudget, recordTokenUsage, TokenBudgetError } from "../lib/rateLimiter";
import { recordAuditEvent } from "../lib/audit";
import { computeHash, GENESIS } from "../lib/hashChain";
import { archiveAndTombstoneEntry, RETENTION_DAYS } from "../lib/retention";

export const journalRouter = Router();

const MAX_ENTRY_CHARS = 8000;
const MAX_REPLY_CHARS = 2000;
const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY ?? ""; // injected by Cloud Run from Secret Manager at runtime

class EntryDeletedError extends Error {
  constructor() {
    super("entry deleted");
    this.name = "EntryDeletedError";
  }
}

function requireUid(req: AuthedRequest, res: Response): string | null {
  if (!req.uid) {
    res.status(401).json({ error: "unauthenticated" });
    return null;
  }
  return req.uid;
}

// ---------------------------------------------------------------------------
// POST /api/entries — create a journal entry
// ---------------------------------------------------------------------------
journalRouter.post("/entries", async (req: AuthedRequest, res: Response) => {
  const uid = requireUid(req, res);
  if (!uid) return;

  const content = String(req.body?.content ?? "").trim().slice(0, MAX_ENTRY_CHARS);
  const clientRequestId = String(req.body?.clientRequestId ?? "");
  const acknowledgedSend = req.body?.acknowledgedSend === true;

  if (!content) return void res.status(400).json({ error: "content is required" });
  if (!clientRequestId) return void res.status(400).json({ error: "clientRequestId is required" });

  const db = getFirestore();

  try {
    const existing = await db
      .collection(`users/${uid}/entries`)
      .where("clientRequestId", "==", clientRequestId)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      return void res.json({ id: doc.id, hash: doc.data().hash, deduplicated: true });
    }

    await enforceRateLimit(uid);
    await enforceTokenBudget(uid);

    // --- Privacy Guardian: deterministic boundary before Gemini ---
    const piiMatches = scanForSensitiveContent(content);
    const piiCategories = [...new Set(piiMatches.map((m) => m.category))];
    const shouldRedactForGemini = piiMatches.length > 0 && !acknowledgedSend;
    const geminiInput = shouldRedactForGemini ? redact(content, piiMatches) : content;

    if (piiMatches.length > 0) {
      await recordAuditEvent(uid, "pii_detected", "success", {
        categories: piiCategories.join(","),
        redactedForGemini: shouldRedactForGemini,
        source: "entry",
      });
    }

    const result = await analyzeEntry(GEMINI_API_KEY(), geminiInput);
    // Never let a metering write be able to block the actual save below —
    // the same "never fail silently on the user's words" principle that
    // already applies to Gemini itself failing.
    await recordTokenUsage(uid, result.tokensUsed).catch(() => undefined);

    const createdAt = new Date().toISOString();
    const chainRef = db.doc(`users/${uid}/meta/chain`);
    const entryRef = db.collection(`users/${uid}/entries`).doc();

    const saved = await db.runTransaction(async (tx) => {
      const chainSnap = await tx.get(chainRef);
      const prevHash: string = chainSnap.exists ? (chainSnap.data() as { headHash: string }).headHash : GENESIS;
      // Hash commits to the RAW content only — never the redacted copy —
      // so integrity verification always checks the user's real words.
      const hash = computeHash(prevHash, uid, content, createdAt);

      const entryDoc = {
        uid,
        clientRequestId,
        deletionState: "active",
        content, // RAW — exactly what the user wrote, never mutated
        createdAt,
        prevHash,
        hash,
        piiDetected: piiCategories,
        sentToGeminiRedacted: shouldRedactForGemini,
        geminiOk: result.ok,
        summary: result.ok ? result.analysis.summary : null, // DERIVED
        topics: result.ok ? result.analysis.topics : [], // DERIVED
        categories: result.ok ? result.analysis.categories : [], // DERIVED — closed-set, used for the topic graph
        reflection: result.ok ? result.analysis.reflection : null, // DERIVED
      };
      tx.set(entryRef, entryDoc);
      tx.set(chainRef, { headHash: hash, updatedAt: FieldValue.serverTimestamp() });
      return entryDoc;
    });

    // Seed the conversation thread with Gemini's own reflection as turn 0,
    // chained off the entry's own hash — the entry anchors its own thread.
    if (result.ok && saved.reflection) {
      const turnCreatedAt = new Date().toISOString();
      const turnHash = computeHash(saved.hash, uid, saved.reflection, turnCreatedAt);
      await db.collection(`users/${uid}/entries/${entryRef.id}/conversation`).add({
        role: "model",
        text: saved.reflection,
        createdAt: turnCreatedAt,
        prevHash: saved.hash,
        hash: turnHash,
      });
    }

    if (!result.ok) {
      await recordAuditEvent(uid, "gemini_fallback", "failure", { reason: result.reason.slice(0, 200) });
    }
    await recordAuditEvent(uid, "entry_created", "success", { entryId: entryRef.id });

    // Never report success before persistence has actually happened —
    // every write above already completed by the time this response fires.
    res.json({ id: entryRef.id, hash: saved.hash, geminiOk: result.ok });
  } catch (err) {
    console.error("POST /api/entries error:", err);
    if (err instanceof RateLimitError) {
      await recordAuditEvent(uid, "rate_limited", "failure", { route: "entries" });
      return void res.status(429).json({ error: err.message });
    }
    if (err instanceof TokenBudgetError) {
      await recordAuditEvent(uid, "rate_limited", "failure", { route: "entries", reason: "token_budget" });
      return void res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: "Couldn't save that entry — try again." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/entries/:entryId/reply — continue the conversation on an entry
// ---------------------------------------------------------------------------
journalRouter.post("/entries/:entryId/reply", async (req: AuthedRequest, res: Response) => {
  const uid = requireUid(req, res);
  if (!uid) return;

  const { entryId } = req.params;
  const text = String(req.body?.text ?? "").trim().slice(0, MAX_REPLY_CHARS);
  const clientRequestId = String(req.body?.clientRequestId ?? "");
  const acknowledgedSend = req.body?.acknowledgedSend === true;

  if (!text) return void res.status(400).json({ error: "text is required" });
  if (!clientRequestId) return void res.status(400).json({ error: "clientRequestId is required" });

  const db = getFirestore();
  const entryRef = db.doc(`users/${uid}/entries/${entryId}`);
  const conversationRef = entryRef.collection("conversation");

  try {
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) return void res.status(404).json({ error: "entry not found" });
    const entryState = entrySnap.data()?.deletionState;
    if (entryState === "deleted" || entryState === "deleting") {
      return void res.status(410).json({ error: "entry deleted" });
    }

    const existing = await conversationRef.where("clientRequestId", "==", clientRequestId).limit(1).get();
    if (!existing.empty) return void res.json({ turnId: existing.docs[0].id, deduplicated: true });

    await enforceRateLimit(uid);
    await enforceTokenBudget(uid);

    // --- Privacy Guardian runs again here — a secret can be typed into a
    // reply just as easily as the original entry. Never skip this because
    // it already ran once on the entry itself. ---
    const piiMatches = scanForSensitiveContent(text);
    const shouldRedactForGemini = piiMatches.length > 0 && !acknowledgedSend;
    const geminiInput = shouldRedactForGemini ? redact(text, piiMatches) : text;

    if (piiMatches.length > 0) {
      await recordAuditEvent(uid, "pii_detected", "success", {
        categories: [...new Set(piiMatches.map((m) => m.category))].join(","),
        redactedForGemini: shouldRedactForGemini,
        source: "reply",
      });
    }

    // Full thread, fetched in order — needed in full below for correct
    // hash-chaining (the true last turn determines prevHash) even though
    // only a recent window of it is sent to Gemini.
    const historySnap = await conversationRef.orderBy("createdAt", "asc").get();
    const fullHistory: ConversationTurn[] = historySnap.docs.map((d) => ({
      role: d.data().role as "user" | "model",
      text: d.data().text as string,
    }));

    // Bounded context for the AI layer (constitution §8): a long-running
    // thread must not grow Gemini token usage and latency without limit.
    // The full thread is still stored and shown to the user in full —
    // this only changes what the model itself sees on any one call.
    const CONTEXT_WINDOW_TURNS = 10;
    const history = fullHistory.slice(-CONTEXT_WINDOW_TURNS);
    history.push({ role: "user", text: geminiInput });

    // Append the user's turn first — chained off the last turn's hash, or
    // the entry's own hash if this is the first reply.
    const lastTurn = historySnap.docs[historySnap.docs.length - 1];
    const entryHash = entrySnap.data()!.hash as string;
    const prevHash = lastTurn ? (lastTurn.data().hash as string) : entryHash;

    const userTurnCreatedAt = new Date().toISOString();
    const userTurnHash = computeHash(prevHash, uid, text, userTurnCreatedAt);
    const userTurnRef = conversationRef.doc();
    await db.runTransaction(async (tx) => {
      const latestEntry = await tx.get(entryRef);
      const latestState = latestEntry.data()?.deletionState;
      if (!latestEntry.exists || latestState === "deleted" || latestState === "deleting") {
        throw new EntryDeletedError();
      }
      tx.create(userTurnRef, {
        role: "user",
        text, // RAW — the user's actual words, never the redacted copy
        clientRequestId,
        createdAt: userTurnCreatedAt,
        prevHash,
        hash: userTurnHash,
      });
    });

    const result = await continueConversation(GEMINI_API_KEY(), history);
    await recordTokenUsage(uid, result.tokensUsed).catch(() => undefined);

    let modelTurnId: string | null = null;
    if (result.ok) {
      const modelTurnCreatedAt = new Date().toISOString();
      const modelTurnHash = computeHash(userTurnHash, uid, result.text, modelTurnCreatedAt);
      const modelTurnRef = conversationRef.doc();
      await db.runTransaction(async (tx) => {
        const latestEntry = await tx.get(entryRef);
        const latestState = latestEntry.data()?.deletionState;
        if (!latestEntry.exists || latestState === "deleted" || latestState === "deleting") {
          throw new EntryDeletedError();
        }
        tx.create(modelTurnRef, {
          role: "model",
          text: result.text,
          createdAt: modelTurnCreatedAt,
          prevHash: userTurnHash,
          hash: modelTurnHash,
        });
      });
      modelTurnId = modelTurnRef.id;
    } else {
      await recordAuditEvent(uid, "gemini_fallback", "failure", { reason: result.reason.slice(0, 200) });
    }

    await recordAuditEvent(uid, "reply_created", "success", { entryId, turnId: userTurnRef.id });
    res.json({ userTurnId: userTurnRef.id, modelTurnId, geminiOk: result.ok });
  } catch (err) {
    console.error("POST /api/entries/:entryId/reply error:", err);
    if (err instanceof EntryDeletedError) {
      return void res.status(410).json({ error: "entry deleted" });
    }
    if (err instanceof RateLimitError) {
      await recordAuditEvent(uid, "rate_limited", "failure", { route: "reply", entryId });
      return void res.status(429).json({ error: err.message });
    }
    if (err instanceof TokenBudgetError) {
      await recordAuditEvent(uid, "rate_limited", "failure", { route: "reply", entryId, reason: "token_budget" });
      return void res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: "Couldn't send that reply — try again." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/verify-integrity — walk the entry chain and every conversation chain
// ---------------------------------------------------------------------------
journalRouter.post("/verify-integrity", async (req: AuthedRequest, res: Response) => {
  const uid = requireUid(req, res);
  if (!uid) return;

  const db = getFirestore();
  const entriesSnap = await db.collection(`users/${uid}/entries`).orderBy("createdAt", "asc").get();

  let expectedPrev = GENESIS;
  let deletedEntries = 0;
  for (const doc of entriesSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const { content, createdAt, prevHash, hash } = data as {
      content: string; createdAt: string; prevHash: string; hash: string;
    };

    // Deleted entries retain only their chain position and cryptographic
    // metadata. Their original content is intentionally no longer available
    // to recompute, so validate linkage and skip the hidden conversation.
    if (data.deletionState === "deleted" || data.deletionState === "deleting") {
      if (typeof prevHash !== "string" || typeof hash !== "string" || prevHash !== expectedPrev) {
        await recordAuditEvent(uid, "integrity_check", "failure", { brokenAt: doc.id, thread: "entries" });
        return void res.json({ valid: false, brokenAt: doc.id, thread: "entries" });
      }
      expectedPrev = hash;
      deletedEntries += 1;
      continue;
    }

    if (prevHash !== expectedPrev || computeHash(prevHash, uid, content, createdAt) !== hash) {
      await recordAuditEvent(uid, "integrity_check", "failure", { brokenAt: doc.id, thread: "entries" });
      return void res.json({ valid: false, brokenAt: doc.id, thread: "entries" });
    }
    expectedPrev = hash;

    // Each entry anchors its own conversation chain.
    const convoSnap = await doc.ref.collection("conversation").orderBy("createdAt", "asc").get();
    let expectedConvoPrev = hash;
    for (const turn of convoSnap.docs) {
      const t = turn.data() as { text: string; createdAt: string; prevHash: string; hash: string };
      if (t.prevHash !== expectedConvoPrev || computeHash(t.prevHash, uid, t.text, t.createdAt) !== t.hash) {
        await recordAuditEvent(uid, "integrity_check", "failure", { brokenAt: turn.id, thread: doc.id });
        return void res.json({ valid: false, brokenAt: turn.id, thread: doc.id });
      }
      expectedConvoPrev = t.hash;
    }
  }

  const visibleEntries = entriesSnap.docs.filter((doc) => {
    const state = doc.data().deletionState;
    return state !== "deleted" && state !== "deleting";
  }).length;
  const retentionSnap = await db.collection(`users/${uid}/retentionEntries`).get();
  const pendingRedactionEntries = retentionSnap.docs.filter(
    (doc) => doc.data().retentionState !== "redacted"
  ).length;

  await recordAuditEvent(uid, "integrity_check", "success", {
    entriesChecked: entriesSnap.size,
    deletedEntries,
    pendingRedactionEntries,
    visibleEntries,
  });
  res.json({
    valid: true,
    entriesChecked: entriesSnap.size,
    deletedEntries,
    pendingRedactionEntries,
    visibleEntries,
  });
});

// ---------------------------------------------------------------------------
// POST /api/entries/:entryId/delete — archive and hide one entry
// ---------------------------------------------------------------------------
journalRouter.post("/entries/:entryId/delete", async (req: AuthedRequest, res: Response) => {
  const uid = requireUid(req, res);
  if (!uid) return;

  const { entryId } = req.params;
  try {
    const result = await archiveAndTombstoneEntry(uid, entryId);
    if (!result.found) return void res.status(404).json({ error: "entry not found" });

    if (result.archived) {
      await recordAuditEvent(uid, "entry_deleted", "success", {
        entryId,
        retentionDays: RETENTION_DAYS,
      });
    }

    res.json({
      deleted: true,
      alreadyDeleted: result.alreadyDeleted,
      retentionDays: RETENTION_DAYS,
      redactAt: result.redactAt?.toDate().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/entries/:entryId/delete error:", err);
    res.status(500).json({ error: "Couldn't remove that entry — try again." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/delete-data — archive and hide the user's journal
// ---------------------------------------------------------------------------
journalRouter.post("/delete-data", async (req: AuthedRequest, res: Response) => {
  const uid = requireUid(req, res);
  if (!uid) return;

  const db = getFirestore();
  const entriesSnap = await db.collection(`users/${uid}/entries`).get();
  let entriesDeleted = 0;

  for (const entryDoc of entriesSnap.docs) {
    const result = await archiveAndTombstoneEntry(uid, entryDoc.id);
    if (result.archived) entriesDeleted += 1;
  }

  // Audit trail deliberately kept — a record of security events, not
  // journal content, and per the constitution must not be editable
  // through normal user operations (deletion counts as an edit).
  await recordAuditEvent(uid, "data_deleted", "success", {
    scope: "journal",
    entriesDeleted,
    retentionDays: RETENTION_DAYS,
  });
  res.json({ deleted: true, entriesDeleted, retentionDays: RETENTION_DAYS });
});
