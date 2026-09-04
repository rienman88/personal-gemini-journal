import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import DeleteEntryModal from "../src/components/DeleteEntryModal.tsx";
import "../src/index.css";

function SmokeHarness() {
  const [open, setOpen] = useState(true);
  const [deleted, setDeleted] = useState(false);

  return (
    <main>
      {deleted && <p data-testid="deleted-status">Entry removed</p>}
      {open && (
        <DeleteEntryModal
          entryId="entry-1"
          onClose={() => setOpen(false)}
          onDeleted={() => setDeleted(true)}
        />
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<SmokeHarness />);
