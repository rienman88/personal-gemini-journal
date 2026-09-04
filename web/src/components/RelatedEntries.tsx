/**
 * LOCAL — ships in the frontend bundle. Purely presentational — the graph
 * itself is built once in JournalList and passed down.
 */
interface RelatedEntry {
  id: string;
  summary: string | null;
  categories: string[];
}

export default function RelatedEntries({ entries }: { entries: RelatedEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="related-entries">
      <p className="derived-label">RELATED — shares a category, not necessarily a theme</p>
      <ul>
        {entries.slice(0, 3).map((e) => (
          <li key={e.id}>{e.summary ?? "(no summary)"}</li>
        ))}
      </ul>
    </div>
  );
}
