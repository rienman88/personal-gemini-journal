import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import JournalEntryCard from "../src/components/JournalEntryCard.tsx";
import "../src/index.css";

const entry = {
  id: "card-entry",
  content: "A long journal entry that remains available in full when the card is expanded.",
  createdAt: "2026-09-03T09:00:00.000Z",
  summary: "A derived summary for the smoke fixture.",
  topics: ["testing"],
  categories: ["work"],
  reflection: "What did you learn?",
  geminiOk: true,
  hash: "a".repeat(64),
  sentToGeminiRedacted: false,
  journalMode: "ai" as const,
};

function SmokeHarness() {
  const [expanded, setExpanded] = useState(true);

  return (
    <main className="app-main">
      <JournalEntryCard
        entry={entry}
        related={[]}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
        onDelete={() => undefined}
        conversation={
          <div className="conversation-thread">
            {Array.from({ length: 90 }, (_, index) => (
              <div key={index} className="turn turn-model">
                Long conversation fixture line {index + 1}. This content exists to prove the expanded journal body provides a bounded scroll area.
              </div>
            ))}
          </div>
        }
      />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<SmokeHarness />);
