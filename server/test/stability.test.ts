/**
 * LOCAL — pure logic tests, no emulator or network needed. STABILITY pillar.
 *
 *   cd server && npm install && npm test
 */
import { expect } from "chai";
import { analyzeEntry, continueConversation } from "../src/lib/geminiClient";

const VALID_JSON = JSON.stringify({
  summary: "ok",
  topics: ["a"],
  categories: ["work"],
  reflection: "?",
});

describe("Stability", () => {
  describe("Schema retry within a single model", () => {
    it("recovers if a later retry on the same model returns valid JSON", async () => {
      let calls = 0;
      const flaky = async () => {
        calls += 1;
        return calls < 2 ? "not json" : VALID_JSON;
      };
      const result = await analyzeEntry("fake-key", "hello", flaky);
      expect(result.ok).to.equal(true);
      expect(calls).to.equal(2);
    });

    it("rejects valid JSON with a category outside the fixed list", async () => {
      const badCategory = async () =>
        JSON.stringify({ summary: "x", topics: ["a"], categories: ["not-a-real-category"], reflection: "?" });
      const result = await analyzeEntry("fake-key", "hello", badCategory);
      expect(result.ok).to.equal(false);
    });
  });

  describe("Model fallback ladder (shared generateContentWithFallback helper)", () => {
    it("falls through to the next model on a retryable status code", async () => {
      const modelsTried: string[] = [];
      const caller = async (model: string) => {
        modelsTried.push(model);
        if (modelsTried.length === 1) throw Object.assign(new Error("unavailable"), { status: 503 });
        return VALID_JSON;
      };
      const result = await analyzeEntry("fake-key", "hello", caller);
      expect(result.ok).to.equal(true);
      expect(modelsTried.length).to.equal(2);
    });

    it("gives a safe, non-throwing failure if every model in the ladder fails", async () => {
      const alwaysDown = async () => {
        throw Object.assign(new Error("down"), { status: 503 });
      };
      const result = await analyzeEntry("fake-key", "hello", alwaysDown);
      expect(result.ok).to.equal(false);
    });

    it("never loops forever — bounded total attempts across the whole ladder", async () => {
      let calls = 0;
      const alwaysBroken = async () => {
        calls += 1;
        return "still not json";
      };
      await analyzeEntry("fake-key", "hello", alwaysBroken);
      // 6 models * (1 initial + 2 schema retries) = 18, and it must terminate
      expect(calls).to.equal(18);
    });

    it("a non-retryable error also falls through to the next model, never throws", async () => {
      // This is the fix, not just a test: a first draft of this refactor
      // rethrew non-retryable errors instead of falling through, which
      // meant a single odd Gemini failure could throw all the way up to
      // the route handler and fail the whole entry save — losing the
      // user's RAW words over a Gemini problem that had nothing to do
      // with them. Confirming it resolves, not rejects, either way.
      const modelsTried: string[] = [];
      const caller = async (model: string) => {
        modelsTried.push(model);
        if (modelsTried.length === 1) throw Object.assign(new Error("bad request"), { status: 400 });
        return VALID_JSON;
      };
      const result = await analyzeEntry("fake-key", "hello", caller);
      expect(result.ok).to.equal(true);
      expect(modelsTried.length).to.equal(2);
    });
  });

  describe("Conversation continuation — routes through the same shared helper", () => {
    it("returns a plain-text reply using conversation history", async () => {
      const caller = async () => "That sounds like a lot to carry.";
      const result = await continueConversation(
        "fake-key",
        [{ role: "model", text: "What felt hardest today?" }, { role: "user", text: "The deadlines." }],
        caller
      );
      expect(result.ok).to.equal(true);
    });

    it("falls back through the ladder on a retryable failure, same as analyzeEntry", async () => {
      let calls = 0;
      const caller = async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("rate limited"), { status: 429 });
        return "Here's a follow-up thought.";
      };
      const result = await continueConversation("fake-key", [{ role: "user", text: "hi" }], caller);
      expect(result.ok).to.equal(true);
      expect(calls).to.equal(2);
    });

    it("an empty response counts as a failed rung, same as a thrown error", async () => {
      let calls = 0;
      const caller = async () => {
        calls += 1;
        return calls < 2 ? "" : "Here's something after all.";
      };
      const result = await continueConversation("fake-key", [{ role: "user", text: "hi" }], caller);
      expect(result.ok).to.equal(true);
      expect(calls).to.equal(2);
    });
  });

  describe("Idempotent writes", () => {
    // Exercising this fully means calling the real route twice with the
    // same clientRequestId against the functions + firestore emulators
    // together. Left as a named pending spec — Mocha reports these as
    // "pending", never as a silent pass — promote it once the emulator
    // harness is wired into CI.
    it("a repeated clientRequestId never creates a second entry or a second reply");
  });
});
