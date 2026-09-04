/**
 * LOCAL — ships in the frontend bundle.
 *
 * The actual "multi-turn" feature: a live thread of replies scoped to one
 * entry, stored in entries/{entryId}/conversation. Privacy Guardian runs
 * on every reply here too, not just the original entry — a secret can be
 * typed into a follow-up message just as easily as the first one.
 */
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { scanForSensitiveContent, PiiMatch } from "../lib/piiDetector";
import { replyToEntry } from "../lib/api";
import PrivacyGuardianModal from "./PrivacyGuardianModal";

interface Turn {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
}

export default function ConversationThread({ entryId }: { entryId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<PiiMatch[] | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, `users/${uid}/entries/${entryId}/conversation`), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setTurns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Turn)));
    });
  }, [entryId]);

  function requestSend() {
    if (!reply.trim()) return;
    const matches = scanForSensitiveContent(reply);
    if (matches.length > 0) setPending(matches);
    else void send(false);
  }

  async function send(acknowledgedSend: boolean) {
    setSending(true);
    setError("");
    try {
      await replyToEntry(entryId, reply, crypto.randomUUID(), acknowledgedSend);
      setReply("");
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that reply — try again.");
    } finally {
      setSending(false);
    }
  }

  function choosePrivacyAction(acknowledgedSend: boolean) {
    setPending(null);
    void send(acknowledgedSend);
  }

  return (
    <div className="conversation-thread">
      {turns.map((t) => (
        <div key={t.id} className={t.role === "model" ? "turn turn-model" : "turn turn-user"}>
          {t.text}
        </div>
      ))}
      <div className="reply-row">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply…"
          disabled={sending}
          aria-label="Reply to this entry"
          data-gramm="false"
          onKeyDown={(e) => {
            if (e.key === "Enter") requestSend();
          }}
        />
        <button onClick={requestSend} disabled={sending || !reply.trim()}>
          {sending ? "…" : "Reply"}
        </button>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <PrivacyGuardianModal
          matches={pending}
          onRedact={() => choosePrivacyAction(false)}
          onSendAnyway={() => choosePrivacyAction(true)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
