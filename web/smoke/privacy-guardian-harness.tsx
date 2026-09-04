import React from "react";
import ReactDOM from "react-dom/client";
import JournalEntryForm from "../src/components/JournalEntryForm.tsx";
import "../src/index.css";

function SmokeHarness() {
  return (
    <main>
      <div data-testid="redact-flow">
        <JournalEntryForm />
      </div>
      <div data-testid="send-anyway-flow">
        <JournalEntryForm />
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<SmokeHarness />);
