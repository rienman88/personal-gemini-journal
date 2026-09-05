export const MAX_AI_ENTRY_CHARS = 3000;
export const MAX_PRIVATE_ENTRY_CHARS = 4000;
export const MAX_AI_REPLY_CHARS = 1500;
export const MAX_PRIVATE_NOTE_CHARS = 1000;

type BoundedTextResult = { ok: true; value: string } | { ok: false; error: string };

export function readBoundedText(value: unknown, field: string, maxChars: number): BoundedTextResult {
  const text = String(value ?? "").trim();
  if (!text) return { ok: false, error: `${field} is required` };
  if (text.length > maxChars) {
    return { ok: false, error: `${field} must be ${maxChars} characters or fewer` };
  }
  return { ok: true, value: text };
}
