import React from "react";
import ReactDOM from "react-dom/client";
import JournalCalendar from "../src/components/JournalCalendar.tsx";
import "../src/index.css";

const entries = [
  { id: "first-entry", createdAt: "2026-09-03T09:00:00" },
  { id: "second-entry", createdAt: "2026-09-03T10:00:00" },
  { id: "later-entry", createdAt: "2026-09-15T10:00:00" },
];

function SmokeHarness() {
  return (
    <main className="app-main">
      <JournalCalendar entries={entries} />
      <div className="entry-feed">
        <article id="entry-first-entry" className="entry-card" style={{ marginTop: "1200px" }}>
          First entry
        </article>
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
