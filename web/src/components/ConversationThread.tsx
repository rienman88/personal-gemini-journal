/**
 * LOCAL - ships in the frontend bundle.
 *
 * AI Journal replies use Gemini through the protected API. Private Journal
 * continuations use the same authenticated, hash-chained conversation path
 * but append only a user-authored note and never call Gemini.
 */
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { scanForSensitiveContent, PiiMatch } from "../lib/piiDetector";
import { JournalMode, replyToEntry } from "../lib/api";
import { JOURNAL_CONTINUATION_LIMITS } from "../lib/limits";
import PrivacyGuardianModal from "./PrivacyGuardianModal";

interface Turn {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: string;
}

export default function ConversationThread({ entryId, journalMode = "ai" }: { entryId: string; journalMode?: JournalMode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<PiiMatch[] | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const continuationLimit = JOURNAL_CONTINUATION_LIMITS[journalMode];

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, `users/${uid}/entries/${entryId}/conversation`), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setTurns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Turn)));
    });
  }, [entryId, journalMode]);

  function requestSend() {
    if (!reply.trim()) return;
    if (journalMode === "private") {
      void send(false);
      return;
    }
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
      setError(err instanceof Error ? err.message : "Couldn't send that continuation - try again.");
    } finally {
      setSending(false);
    }
  }

  function choosePrivacyAction(acknowledgedSend: boolean) {
    setPending(null);
    void send(acknowledgedSend);
  }

  const isPrivate = journalMode === "private";

  return (
    <div className={`conversation-thread${isPrivate ? " private-conversation" : ""}`}>
      <p className="derived-label">{isPrivate ? "PRIVATE JOURNAL - PRIVATE NOTES" : "AI JOURNAL - GEMINI REPLIES"}</p>
      {turns.map((turn) => (
        <div key={turn.id} className={turn.role === "model" ? "turn turn-model" : "turn turn-user"}>
          {turn.text}
        </div>
      ))}
      <div className="reply-row">
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder={isPrivate ? "Add a private note..." : "Reply..."}
          disabled={sending}
          aria-label={isPrivate ? "Add a private note to this entry" : "Reply to this entry"}
          data-gramm="false"
          maxLength={continuationLimit}
          rows={3}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              requestSend();
            }
          }}
        />
        <div className="reply-controls">
          <span className="character-counter" aria-live="polite">
            {reply.length}/{continuationLimit}
          </span>
          <button onClick={requestSend} disabled={sending || !reply.trim()}>
            {sending ? "..." : isPrivate ? "Add private note" : "Reply"}
          </button>
        </div>
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
