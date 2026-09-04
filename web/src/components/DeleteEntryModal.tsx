// LOCAL - ships in the frontend bundle.
import { useState } from "react";
import { deleteEntry } from "../lib/api";

interface DeleteEntryModalProps {
  entryId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteEntryModal({ entryId, onClose, onDeleted }: DeleteEntryModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteEntry(entryId);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove entry");
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-entry-title">
        <p className="modal-eyebrow">PRIVACY GUARDIAN</p>
        <h2 id="delete-entry-title" style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>
          Remove this journal entry?
        </h2>
        <p className="modal-explain">
          This entry will disappear from your journal and calendar immediately. Its protected record will be retained for up to 30 days, then privacy-redacted. Security audit records are retained.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <div className="modal-actions">
          <button className="secondary" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removing Entry…" : "Remove Entry"}
          </button>
          <button onClick={onClose} disabled={deleting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
