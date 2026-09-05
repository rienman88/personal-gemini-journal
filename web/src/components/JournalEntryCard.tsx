import type { ReactNode } from "react";
import { JournalMode } from "../lib/api";
import RelatedEntries from "./RelatedEntries";

export interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
  summary: string | null;
  topics: string[];
  categories: string[];
  reflection: string | null;
  geminiOk: boolean;
  hash: string;
  sentToGeminiRedacted: boolean;
  journalMode?: JournalMode;
  aiUsed?: boolean;
  deletionState?: "active" | "deleted" | "deleting";
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  related: JournalEntry[];
  expanded: boolean;
  conversation: ReactNode;
  onToggle: () => void;
  onDelete: () => void;
}

export default function JournalEntryCard({
  entry,
  related,
  expanded,
  conversation,
  onToggle,
  onDelete,
}: JournalEntryCardProps) {
  const journalMode = entry.journalMode ?? "ai";
  const bodyId = `entry-body-${entry.id}`;
  const dateLabel = new Date(entry.createdAt).toLocaleDateString();

  return (
    <article id={`entry-${entry.id}`} className={`entry-card${expanded ? " is-expanded" : " is-collapsed"}`}>
      <div className="entry-card-header">
        <p className="entry-text entry-preview">{entry.content}</p>
        <div className="entry-card-header-actions">
          <button
            className="link-button entry-delete-button"
            data-testid={`delete-entry-${entry.id}`}
            onClick={onDelete}
            aria-label={`Remove journal entry from ${dateLabel}`}
          >
            Remove entry
          </button>
          <button
            type="button"
            className="entry-toggle"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label={`${expanded ? "Collapse" : "Expand"} journal entry from ${dateLabel}`}
          >
            <span aria-hidden="true" className={`entry-toggle-icon${expanded ? " is-expanded" : ""}`}>
              ⌄
            </span>
          </button>
        </div>
      </div>

      <div id={bodyId} className="entry-card-body" hidden={!expanded}>
        <div className="original-entry-block">
          <p className="derived-label">YOUR ORIGINAL ENTRY</p>
          <p className="entry-text">{entry.content}</p>
        </div>
        <div className="entry-meta">
          <span>{new Date(entry.createdAt).toLocaleString()}</span>
          <span className="hash-chip" title={entry.hash}>
            #{entry.hash.slice(0, 8)}
          </span>
          {entry.categories?.map((category) => (
            <span key={category} className="pill pill-category">
              {category}
            </span>
          ))}
          {entry.sentToGeminiRedacted && <span className="pill pill-flagged">redacted before Gemini</span>}
          <span className={`pill ${journalMode === "private" ? "pill-private" : "pill-category"}`}>
            {journalMode === "private" ? "Private Journal · AI not used" : "AI Journal"}
          </span>
        </div>

        {journalMode === "private" ? (
          <div className="private-block">
            <p className="derived-label">PRIVATE JOURNAL — AI NOT USED</p>
            <p>Saved without Gemini analysis or AI response. Private notes remain available.</p>
          </div>
        ) : entry.geminiOk ? (
          <div className="derived-block">
            <p className="derived-label">DERIVED — from Gemini, not your words</p>
            <p>{entry.summary}</p>
            <p className="topics">{entry.topics.join(" · ")}</p>
          </div>
        ) : (
          <p className="derived-label pill-flagged">Summary unavailable — your words are saved regardless</p>
        )}

        <RelatedEntries entries={related} />
        {conversation}
      </div>
    </article>
  );
}
