/**
 * LOCAL - user-facing choice between the existing Gemini flow and a
 * server-enforced no-Gemini journal entry.
 */
import { useState } from "react";
import { JournalMode } from "../lib/api";

interface JournalModeToggleProps {
  mode: JournalMode;
  ready: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (mode: JournalMode) => Promise<void>;
}

export default function JournalModeToggle({ mode, ready, disabled = false, error, onChange }: JournalModeToggleProps) {
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const nextMode: JournalMode = mode === "ai" ? "private" : "ai";

  async function toggle() {
    setSaving(true);
    setLocalError("");
    try {
      await onChange(nextMode);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Couldn't change journal mode.");
    } finally {
      setSaving(false);
    }
  }

  const status = !ready
    ? "Loading your saved preference..."
    : mode === "ai"
      ? "AI summaries, reflections, categories, and replies are enabled."
      : "Entries are saved without Gemini processing or AI replies.";

  return (
    <section className="journal-mode-control" aria-labelledby="journal-mode-title">
      <div>
        <p className="mode-eyebrow">JOURNAL MODE</p>
        <h2 id="journal-mode-title">Choose how new entries are processed</h2>
      </div>
      <div className="mode-switch-row">
        <span className={mode === "ai" ? "mode-option active" : "mode-option"}>AI Journal</span>
        <button
          type="button"
          role="switch"
          aria-checked={mode === "ai"}
          aria-label={`Switch to ${nextMode === "ai" ? "AI Journal" : "Private Journal"}`}
          className={`mode-switch ${mode === "ai" ? "is-ai" : "is-private"}`}
          onClick={toggle}
          disabled={!ready || disabled || saving}
          data-testid="journal-mode-toggle"
        >
          <span className="mode-switch-thumb" />
        </button>
        <span className={mode === "private" ? "mode-option active" : "mode-option"}>Private Journal</span>
      </div>
      <p className="mode-status" data-testid="journal-mode-status">
        {saving ? "Saving your preference..." : status}
      </p>
      {(error || localError) && <p className="auth-error" role="alert">{error || localError}</p>}
    </section>
  );
}
