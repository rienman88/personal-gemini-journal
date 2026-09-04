/**
 * LOCAL — ships in the frontend bundle.
 *
 * Client-side preview of the Privacy Guardian scan, for fast feedback
 * only. The server re-runs the same scan and is the actual enforcement
 * boundary, on both entries and replies — this modal shapes what gets
 * sent, it can't be relied on as the real gate.
 */
import { PiiMatch } from "../lib/piiDetector";

interface Props {
  matches: PiiMatch[];
  onRedact: () => void;
  onSendAnyway: () => void;
  onCancel: () => void;
}

export default function PrivacyGuardianModal({ matches, onRedact, onSendAnyway, onCancel }: Props) {
  const categories = [...new Set(matches.map((m) => m.category))];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pg-title">
      <div className="modal-card">
        <p className="modal-eyebrow">PRIVACY GUARDIAN</p>
        <h2 id="pg-title">This looks like it contains sensitive info</h2>
        <p>Detected: {categories.join(", ").replace(/_/g, " ")}.</p>
        <p className="modal-explain">
          Your journal keeps your original words exactly as written either way. This choice only affects what
          gets sent to Gemini.
        </p>
        <div className="modal-actions">
          <button onClick={onRedact} autoFocus>
            Redact before sending to Gemini
          </button>
          <button onClick={onSendAnyway} className="secondary">
            Send as-is anyway
          </button>
          <button onClick={onCancel} className="link-button">
            Go back and edit
          </button>
        </div>
      </div>
    </div>
  );
}
