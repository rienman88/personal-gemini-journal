// LOCAL — ships in the frontend bundle.
import { useState } from "react";
import { deleteData } from "../lib/api";

interface DeleteDataModalProps {
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteDataModal({ onClose, onDeleted }: DeleteDataModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteData();
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete data");
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="modal-eyebrow">PRIVACY LIFECYCLE</p>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>Remove All Journal Entries?</h2>
        <p className="modal-explain">
          All entries and conversations will disappear from your journal and calendar immediately. Protected records are retained for up to 30 days, then privacy-redacted. Cryptographic chain metadata and security audit records are retained.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <div className="modal-actions">
          <button className="secondary" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removing Entries…" : "Remove All Entries"}
          </button>
          <button onClick={onClose} disabled={deleting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
