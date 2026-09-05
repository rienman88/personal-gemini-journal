/**
 * CLOUD - user-controlled AI processing policy.
 *
 * The browser can present the switch, but this policy is evaluated by the
 * Express routes before any Gemini or token-budget work begins.
 */

export type JournalMode = "ai" | "private";

export const DEFAULT_JOURNAL_MODE: JournalMode = "ai";

export interface JournalModePlan {
  useGemini: boolean;
  runPrivacyGuardian: boolean;
  consumeTokenBudget: boolean;
  createConversation: boolean;
}

export function parseJournalMode(value: unknown): JournalMode | null {
  return value === "ai" || value === "private" ? value : null;
}

export function journalModeFromData(data: Record<string, unknown> | undefined): JournalMode {
  return parseJournalMode(data?.journalMode) ?? DEFAULT_JOURNAL_MODE;
}

export function getJournalModePlan(mode: JournalMode): JournalModePlan {
  if (mode === "private") {
    return {
      useGemini: false,
      runPrivacyGuardian: false,
      consumeTokenBudget: false,
      createConversation: false,
    };
  }

  return {
    useGemini: true,
    runPrivacyGuardian: true,
    consumeTokenBudget: true,
    createConversation: true,
  };
}
