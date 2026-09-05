/**
 * CLOUD — deploys inside the Cloud Run container.
 *
 * Security audit trail, separate from journal content. Never journal
 * text, tokens, or keys — only what a security review would need.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

export type AuditEventType =
  | "entry_created"
  | "reply_created"
  | "pii_detected"
  | "gemini_fallback"
  | "integrity_check"
  | "rate_limited"
  | "auth_rejected"
  | "data_deleted"
  | "entry_deleted"
  | "entry_redacted"
  | "journal_mode_changed";

export async function recordAuditEvent(
  uid: string,
  type: AuditEventType,
  outcome: "success" | "failure",
  detail: Record<string, string | number | boolean> = {}
): Promise<string> {
  const db = getFirestore();
  const correlationId = randomUUID();
  await db.collection(`users/${uid}/audit`).doc().set({
    type,
    outcome,
    correlationId,
    detail,
    timestamp: FieldValue.serverTimestamp(),
  });
  return correlationId;
}
