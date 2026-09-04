/**
 * LOCAL — ships in the frontend bundle. Kept in sync with
 * server/src/lib/piiDetector.ts on purpose. This copy exists only for
 * instant feedback while typing — it is NOT the enforcement boundary. The
 * server re-runs the same scan on both entries and replies, and that's the
 * copy that actually decides what reaches Gemini.
 */

export type PiiCategory = "aws_access_key" | "google_api_key" | "generic_secret_assignment" | "email" | "phone" | "ssn";

export interface PiiMatch {
  category: PiiCategory;
  match: string;
  index: number;
}

const PATTERNS: { category: PiiCategory; regex: RegExp }[] = [
  { category: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { category: "google_api_key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  {
    category: "generic_secret_assignment",
    regex: /\b(api[_-]?key|secret|token|password)\s*[:=]\s*['"][\w\-.]{12,}['"]/gi,
  },
  { category: "email", regex: /\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g },
  { category: "phone", regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { category: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
];

export function scanForSensitiveContent(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const { category, regex } of PATTERNS) {
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) matches.push({ category, match: m[0], index: m.index });
  }
  return matches;
}
