export const MAX_ENTRY_CHARS = 8000;
export const MAX_REPLY_CHARS = 2000;

type BoundedTextResult = { ok: true; value: string } | { ok: false; error: string };

export function readBoundedText(value: unknown, field: string, maxChars: number): BoundedTextResult {
  const text = String(value ?? "").trim();
  if (!text) return { ok: false, error: `${field} is required` };
  if (text.length > maxChars) {
    return { ok: false, error: `${field} must be ${maxChars} characters or fewer` };
  }
  return { ok: true, value: text };
}
