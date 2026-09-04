/**
 * CLOUD — deploys inside the Cloud Run container.
 *
 * Deterministic secret/PII scanner — the "Privacy Guardian" boundary.
 * Runs before ANY text reaches Gemini — the initial entry AND every
 * conversation reply, since a secret can just as easily be typed into a
 * follow-up message as into the first entry.
 *
 * Kept in sync with web/src/lib/piiDetector.ts on purpose. That copy is
 * only a fast client-side preview; this is the copy that's actually
 * trusted, since a client-side check can always be bypassed.
 */

export type PiiCategory =
  | "aws_access_key"
  | "google_api_key"
  | "generic_secret_assignment"
  | "email"
  | "phone"
  | "ssn";

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
  { category: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g }, // US SSN format specifically (3-2-4) — distinct grouping from the phone pattern above (3-3-4), so it needs its own rule rather than relying on phone to catch it
];

export function scanForSensitiveContent(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const { category, regex } of PATTERNS) {
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ category, match: m[0], index: m.index });
    }
  }
  return matches;
}

/** Used only for the copy sent to Gemini — never applied to what's stored. */
export function redact(text: string, matches: PiiMatch[]): string {
  let result = text;
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  for (const m of sorted) {
    result = result.slice(0, m.index) + `[REDACTED:${m.category.toUpperCase()}]` + result.slice(m.index + m.match.length);
  }
  return result;
}
