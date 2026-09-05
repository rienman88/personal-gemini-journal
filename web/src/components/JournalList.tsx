/**
 * LOCAL — ships in the frontend bundle.
 *
 * Reads directly from Firestore (allowed by the rules for the owner)
 * rather than through the API, since this is a read, not a write. Builds
 * the category graph once per snapshot from data already being fetched
 * for display — no extra call for that either.
 */
import { useEffect, useMemo, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { JournalMode } from "../lib/api";
import { buildCategoryGraph, relatedEntryIds } from "../lib/topicGraph";
import ConversationThread from "./ConversationThread";
import JournalCalendar from "./JournalCalendar";
import RelatedEntries from "./RelatedEntries";
import DeleteEntryModal from "./DeleteEntryModal";

interface Entry {
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

export default function JournalList() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, `users/${uid}/entries`), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setEntries(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Entry))
          .filter((entry) => entry.deletionState !== "deleted" && entry.deletionState !== "deleting")
      );
    });
  }, []);

  function handleDeleted(entryId: string) {
    // The API already changed Firestore, but this removes the entry from the
    // feed and derived calendar in the same render rather than waiting for
    // the snapshot listener's round trip.
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  }

  const graph = useMemo(() => buildCategoryGraph(entries), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  if (entries.length === 0) {
    return <p className="empty-state">Nothing here yet — your first entry will show up after you save it.</p>;
  }

  return (
    <div className="journal-layout">
      <JournalCalendar entries={entries} />
      <div className="entry-feed">
        {entries.map((e) => {
          const journalMode = e.journalMode ?? "ai";
          const related = relatedEntryIds(e, graph)
            .map((id) => byId.get(id))
            .filter((x): x is Entry => Boolean(x));

          return (
            <article key={e.id} id={`entry-${e.id}`} className="entry-card">
              <p className="entry-text">{e.content}</p>
              <div className="entry-meta">
                <span>{new Date(e.createdAt).toLocaleString()}</span>
                <span className="hash-chip" title={e.hash}>
                  #{e.hash.slice(0, 8)}
                </span>
                {e.categories?.map((c) => (
                  <span key={c} className="pill pill-category">
                    {c}
                  </span>
                ))}
                {e.sentToGeminiRedacted && <span className="pill pill-flagged">redacted before Gemini</span>}
                <span className={`pill ${journalMode === "private" ? "pill-private" : "pill-category"}`}>
                  {journalMode === "private" ? "Private Journal · AI not used" : "AI Journal"}
                </span>
              </div>
              <div className="entry-actions">
                <button
                  className="link-button entry-delete-button"
                  data-testid={`delete-entry-${e.id}`}
                  onClick={() => setDeleteTarget(e)}
                  aria-label={`Remove journal entry from ${new Date(e.createdAt).toLocaleDateString()}`}
                >
                  Remove entry
                </button>
              </div>

              {journalMode === "private" ? (
                <div className="private-block">
                  <p className="derived-label">PRIVATE JOURNAL — AI NOT USED</p>
                  <p>Saved without Gemini analysis, derived insight, or AI conversation.</p>
                </div>
              ) : e.geminiOk ? (
                <div className="derived-block">
                  <p className="derived-label">DERIVED — from Gemini, not your words</p>
                  <p>{e.summary}</p>
                  <p className="topics">{e.topics.join(" · ")}</p>
                </div>
              ) : (
                <p className="derived-label pill-flagged">Summary unavailable — your words are saved regardless</p>
              )}

              <RelatedEntries entries={related} />
              <ConversationThread entryId={e.id} journalMode={journalMode} />
            </article>
          );
        })}
      </div>
      {deleteTarget && (
        <DeleteEntryModal
          entryId={deleteTarget.id}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => handleDeleted(deleteTarget.id)}
        />
      )}
    </div>
  );
}
