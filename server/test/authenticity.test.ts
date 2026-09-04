/**
 * LOCAL — the static check always runs; the smoke test is honestly
 * skipped (not faked) without a real key. AUTHENTICITY pillar.
 *
 *   cd server && npm install && npm test
 *   GEMINI_API_KEY_TEST=your-real-key npm test   # also runs the live smoke test
 */
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";

describe("Authenticity", () => {
  it("no mock/fake/stub AI provider exists anywhere in the source tree", () => {
    const libDir = path.join(__dirname, "../src/lib");
    const offendingPatterns = [/MockGemini/i, /FakeGemini/i, /StubGemini/i, /class\s+.*MockAI/i];
    const files = fs.readdirSync(libDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const contents = fs.readFileSync(path.join(libDir, file), "utf8");
      for (const pattern of offendingPatterns) {
        expect(pattern.test(contents), `${file} matched forbidden pattern ${pattern}`).to.equal(false);
      }
    }
  });

  it(
    "analyzeEntry calls the real @google/genai SDK and gets a real answer (skipped without a live key, never faked)",
    async function () {
      if (!process.env.GEMINI_API_KEY_TEST) {
        this.skip();
      }
      const { analyzeEntry } = await import("../src/lib/geminiClient");
      const result = await analyzeEntry(
        process.env.GEMINI_API_KEY_TEST!,
        "A short test entry about learning to bake bread."
      );
      expect(result.ok).to.equal(true);
    }
  );
});
