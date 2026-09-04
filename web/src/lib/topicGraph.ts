/**
 * LOCAL — ships in the frontend bundle.
 *
 * A small, real graph — category nodes and entry nodes, edges between
 * them — built entirely from data already loaded for the entry list. No
 * new backend call, no new Firestore read, no new Gemini call, no new
 * token cost. UGL-*inspired* in philosophy (deterministic, discovery-only
 * representation), not a use of UGL's actual code.
 *
 * Honest limitation: this connects entries that share a `category` (a
 * closed, fixed set Gemini already picks from) — not full semantic
 * similarity. "career stress" and "work anxiety" as free-form `topics`
 * won't connect on their own, but both plausibly land in the `work`
 * category, which is what this graph actually clusters on.
 */

export interface GraphableEntry {
  id: string;
  categories: string[];
}

export type CategoryGraph = Map<string, Set<string>>; // normalized category -> entry ids

export function buildCategoryGraph(entries: GraphableEntry[]): CategoryGraph {
  const graph: CategoryGraph = new Map();
  for (const entry of entries) {
    for (const category of entry.categories ?? []) {
      const key = category.trim().toLowerCase();
      if (!key) continue;
      if (!graph.has(key)) graph.set(key, new Set());
      graph.get(key)!.add(entry.id);
    }
  }
  return graph;
}

export function relatedEntryIds(entry: GraphableEntry, graph: CategoryGraph): string[] {
  const related = new Set<string>();
  for (const category of entry.categories ?? []) {
    const key = category.trim().toLowerCase();
    graph.get(key)?.forEach((id) => {
      if (id !== entry.id) related.add(id);
    });
  }
  return [...related];
}
