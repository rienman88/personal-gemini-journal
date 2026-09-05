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
import { buildCategoryGraph, relatedEntryIds } from "../lib/topicGraph";
import ConversationThread from "./ConversationThread";
import JournalCalendar from "./JournalCalendar";
import DeleteEntryModal from "./DeleteEntryModal";
import JournalEntryCard, { JournalEntry } from "./JournalEntryCard";

export default function JournalList() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [collapsedEntryIds, setCollapsedEntryIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, `users/${uid}/entries`), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setEntries(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as JournalEntry))
          .filter((entry) => entry.deletionState !== "deleted" && entry.deletionState !== "deleting")
      );
    });
  }, []);

  function handleDeleted(entryId: string) {
    // The API already changed Firestore, but this removes the entry from the
    // feed and derived calendar in the same render rather than waiting for
    // the snapshot listener's round trip.
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setCollapsedEntryIds((current) => {
      const next = new Set(current);
      next.delete(entryId);
      return next;
    });
  }

  function toggleEntry(entryId: string) {
    setCollapsedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  function expandEntry(entryId: string) {
    setCollapsedEntryIds((current) => {
      if (!current.has(entryId)) return current;
      const next = new Set(current);
      next.delete(entryId);
      return next;
    });
  }

  const graph = useMemo(() => buildCategoryGraph(entries), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  if (entries.length === 0) {
    return <p className="empty-state">Nothing here yet — your first entry will show up after you save it.</p>;
  }

  return (
    <div className="journal-layout">
      <JournalCalendar entries={entries} onSelectEntry={expandEntry} />
      <div className="entry-feed">
        {entries.map((e) => {
          const related = relatedEntryIds(e, graph)
            .map((id) => byId.get(id))
            .filter((x): x is JournalEntry => Boolean(x));

          return (
            <JournalEntryCard
              key={e.id}
              entry={e}
              related={related}
              expanded={!collapsedEntryIds.has(e.id)}
              onToggle={() => toggleEntry(e.id)}
              onDelete={() => setDeleteTarget(e)}
              conversation={<ConversationThread entryId={e.id} journalMode={e.journalMode ?? "ai"} />}
            />
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
