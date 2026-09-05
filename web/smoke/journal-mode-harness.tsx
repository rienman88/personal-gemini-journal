import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import JournalModeToggle from "../src/components/JournalModeToggle.tsx";
import JournalEntryForm from "../src/components/JournalEntryForm.tsx";
import { JournalMode } from "../src/lib/api";
import "../src/index.css";

function SmokeHarness() {
  const [mode, setMode] = useState<JournalMode>("ai");

  return (
    <main className="app-main">
      <JournalModeToggle mode={mode} ready onChange={async (nextMode) => setMode(nextMode)} />
      <div data-testid="private-entry-flow">
        <JournalEntryForm journalMode={mode} />
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<SmokeHarness />);
