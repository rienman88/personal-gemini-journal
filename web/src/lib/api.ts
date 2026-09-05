/**
 * LOCAL — ships in the frontend bundle.
 *
 * Replaces the old httpsCallable pattern now that the backend is a plain
 * Express service, not Callable Functions. VITE_API_BASE_URL is empty in
 * production (frontend and API are same-origin, one Cloud Run service) and
 * points at the local server (default http://localhost:8081) in dev.
 */
import { getToken } from "firebase/app-check";
import { appCheck, auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface IntegrityVerificationResult {
  valid: boolean;
  entriesChecked?: number;
  deletedEntries?: number;
  pendingRedactionEntries?: number;
  visibleEntries?: number;
  brokenAt?: string;
  thread?: string;
}

export type JournalMode = "ai" | "private";

export interface JournalPreferences {
  journalMode: JournalMode;
}

async function authedFetch(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (appCheck) {
    try {
      const appCheckToken = await getToken(appCheck);
      headers["X-Firebase-AppCheck"] = appCheckToken.token;
    } catch {
      throw new Error("App verification is unavailable. Refresh the page and try again.");
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function getJournalPreferences(): Promise<JournalPreferences> {
  return authedFetch("/api/preferences", undefined, "GET");
}

export function updateJournalMode(journalMode: JournalMode): Promise<JournalPreferences> {
  return authedFetch("/api/preferences", { journalMode });
}

export function createEntry(content: string, clientRequestId: string, acknowledgedSend: boolean) {
  return authedFetch("/api/entries", { content, clientRequestId, acknowledgedSend });
}

export function replyToEntry(entryId: string, text: string, clientRequestId: string, acknowledgedSend: boolean) {
  return authedFetch(`/api/entries/${entryId}/reply`, { text, clientRequestId, acknowledgedSend });
}

export function verifyIntegrity(): Promise<IntegrityVerificationResult> {
  return authedFetch("/api/verify-integrity");
}

export function deleteData() {
  return authedFetch("/api/delete-data");
}

export function deleteEntry(entryId: string) {
  return authedFetch(`/api/entries/${entryId}/delete`);
}
