/**
 * CLOUD — deploys inside the Cloud Run container.
 *
 * Two separate per-user cost/abuse controls, deliberately distinct because
 * they catch different attack shapes:
 *  - Request rate limit: stops rapid-fire button-spamming in a short window.
 *  - Daily token budget: stops a *low-frequency* pattern of very expensive
 *    calls that would stay under the request-rate limit while still
 *    draining real cost — the rate limiter alone wouldn't catch this,
 *    since it counts requests, not what each one actually costs.
 * Neither replaces Cloud Armor / App Check at real scale — both stop a
 * single account from turning the endpoint into a personal Gemini proxy.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8; // slightly higher than before — a reply is now a second write type sharing this limit
const DAILY_TOKEN_BUDGET = 50_000; // generous relative to real demo usage; sized to catch abuse, not normal use

export class RateLimitError extends Error {}
export class TokenBudgetError extends Error {}

export async function enforceRateLimit(uid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.doc(`users/${uid}/meta/rateLimit`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? (snap.data() as { windowStart: number; count: number }) : null;

    if (!data || now - data.windowStart > WINDOW_MS) {
      tx.set(ref, { windowStart: now, count: 1 });
      return;
    }
    if (data.count >= MAX_PER_WINDOW) {
      throw new RateLimitError("Too many requests — please wait a moment before trying again.");
    }
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

/** Pre-check, before calling Gemini at all. */
export async function enforceTokenBudget(uid: string): Promise<void> {
  const db = getFirestore();
  const snap = await db.doc(`users/${uid}/usage/${todayKey()}`).get();
  const tokensUsed = snap.exists ? ((snap.data() as { tokensUsed?: number }).tokensUsed ?? 0) : 0;
  if (tokensUsed >= DAILY_TOKEN_BUDGET) {
    throw new TokenBudgetError("Daily AI usage limit reached — please try again tomorrow.");
  }
}

/**
 * Post-call accounting. Called with whatever analyzeEntry/continueConversation
 * report as actually spent — including tokens burned on attempts that were
 * later retried or ultimately failed, since those still cost real money and
 * a budget that only counted successful calls would undercount real spend.
 */
export async function recordTokenUsage(uid: string, tokenCount: number): Promise<void> {
  if (tokenCount <= 0) return;
  const db = getFirestore();
  await db.doc(`users/${uid}/usage/${todayKey()}`).set(
    { tokensUsed: FieldValue.increment(tokenCount), lastRequest: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
