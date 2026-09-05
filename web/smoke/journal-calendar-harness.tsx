import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import JournalCalendar from "../src/components/JournalCalendar.tsx";
import JournalEntryCard from "../src/components/JournalEntryCard.tsx";
import "../src/index.css";

const entries = [
  { id: "first-entry", createdAt: "2026-09-03T09:00:00" },
  { id: "second-entry", createdAt: "2026-09-03T10:00:00" },
  { id: "later-entry", createdAt: "2026-09-15T10:00:00" },
];

function SmokeHarness() {
  const [expanded, setExpanded] = useState(false);

  return (
    <main className="app-main">
      <JournalCalendar
        entries={entries}
        onSelectEntry={(entryId) => {
          if (entryId === "first-entry") setExpanded(true);
        }}
      />
      <div className="entry-feed">
        <div style={{ marginTop: "1200px" }}>
          <JournalEntryCard
            entry={{
              id: "first-entry",
              content: "First entry selected from the calendar.",
              createdAt: "2026-09-03T09:00:00",
              summary: "A calendar navigation smoke fixture.",
              topics: ["testing"],
              categories: ["work"],
              reflection: "What did the calendar help you find?",
              geminiOk: true,
              hash: "a".repeat(64),
              sentToGeminiRedacted: false,
              journalMode: "ai",
            }}
            related={[]}
            expanded={expanded}
            onToggle={() => setExpanded((current) => !current)}
            onDelete={() => undefined}
            conversation={<div className="conversation-thread">Calendar-selected conversation</div>}
          />
        </div>
        <article id="entry-second-entry" className="entry-card">
          Second entry
        </article>
        <article id="entry-later-entry" className="entry-card">
          Later entry
        </article>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<SmokeHarness />);
