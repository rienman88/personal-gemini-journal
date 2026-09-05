/**
 * LOCAL — ships in the frontend bundle.
 *
 * Runs the client-side PII preview, shows the Privacy Guardian modal if
 * needed, then calls the Express API. No manual refresh needed after —
 * JournalList listens to Firestore in real time.
 */
import { useEffect, useState } from "react";
import { scanForSensitiveContent, PiiMatch } from "../lib/piiDetector";
import { createEntry, JournalMode } from "../lib/api";
import PrivacyGuardianModal from "./PrivacyGuardianModal";

export default function JournalEntryForm({ journalMode = "ai", disabled = false }: { journalMode?: JournalMode; disabled?: boolean }) {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState<PiiMatch[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (journalMode === "private") setPending(null);
  }, [journalMode]);

  function requestSave() {
    if (!content.trim()) return;
    if (journalMode === "private") {
      void save(false);
      return;
    }
    const matches = scanForSensitiveContent(content);
    if (matches.length > 0) setPending(matches);
    else void save(false);
  }

  async function save(acknowledgedSend: boolean) {
    setSaving(true);
    setError("");
    try {
      await createEntry(content, crypto.randomUUID(), acknowledgedSend);
      setContent("");
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that entry — try again.");
    } finally {
      setSaving(false);
    }
  }

  function choosePrivacyAction(acknowledgedSend: boolean) {
    setPending(null);
    void save(acknowledgedSend);
  }

  return (
    <section className="composer">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write today's entry…"
        rows={6}
        disabled={disabled || saving}
        aria-label="Journal entry"
        data-gramm="false"
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button onClick={requestSave} disabled={disabled || saving || !content.trim()}>
        {saving ? "Saving…" : error ? "Retry Save" : "Save entry"}
      </button>

      {pending && (
        <PrivacyGuardianModal
          matches={pending}
          onRedact={() => choosePrivacyAction(false)}
          onSendAnyway={() => choosePrivacyAction(true)}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
