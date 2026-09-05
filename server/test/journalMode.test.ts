/**
 * LOCAL - user-controlled AI mode policy tests.
 */
import { expect } from "chai";
import { DEFAULT_JOURNAL_MODE, getJournalModePlan, journalModeFromData, parseJournalMode } from "../src/lib/journalMode";

describe("Journal mode policy", () => {
  it("defaults missing or invalid preferences to the existing AI flow", () => {
    expect(DEFAULT_JOURNAL_MODE).to.equal("ai");
    expect(journalModeFromData(undefined)).to.equal("ai");
    expect(journalModeFromData({ journalMode: "unexpected" })).to.equal("ai");
  });

  it("accepts only the two supported modes", () => {
    expect(parseJournalMode("ai")).to.equal("ai");
    expect(parseJournalMode("private")).to.equal("private");
    expect(parseJournalMode("AI")).to.equal(null);
    expect(parseJournalMode(undefined)).to.equal(null);
  });

  it("keeps the current Gemini pipeline intact for AI mode", () => {
    expect(getJournalModePlan("ai")).to.deep.equal({
      useGemini: true,
      runPrivacyGuardian: true,
      consumeTokenBudget: true,
      createConversation: true,
    });
  });

  it("prevents every Gemini-specific operation in Private Journal mode", () => {
    expect(getJournalModePlan("private")).to.deep.equal({
      useGemini: false,
      runPrivacyGuardian: false,
      consumeTokenBudget: false,
      createConversation: false,
    });
  });
});
