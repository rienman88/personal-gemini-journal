/**
 * LOCAL — runs against the Firebase emulator suite, never deployed.
 * SECURITY pillar.
 *
 *   cd server && npm install
 *   firebase emulators:exec --only firestore,auth "npm test"
 */
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { scanForSensitiveContent, redact } from "../src/lib/piiDetector";

describe("Security", () => {
  describe("Privacy Guardian detector", () => {
    it("catches a fake AWS access key", () => {
      const matches = scanForSensitiveContent("my key is AKIAABCDEFGHIJKLMNOP, don't lose it");
      expect(matches.some((m) => m.category === "aws_access_key")).to.equal(true);
    });

    it("catches an email address", () => {
      const matches = scanForSensitiveContent("reach me at test.person@example.com");
      expect(matches.some((m) => m.category === "email")).to.equal(true);
    });

    it("redact() removes every detected span from the Gemini-bound copy", () => {
      const text = "key: AKIAABCDEFGHIJKLMNOP";
      const matches = scanForSensitiveContent(text);
      const redacted = redact(text, matches);
      expect(redacted).to.not.include("AKIAABCDEFGHIJKLMNOP");
      expect(redacted).to.include("[REDACTED:AWS_ACCESS_KEY]");
    });

    it("catches a US SSN pattern, distinct from the phone regex's 3-3-4 grouping", () => {
      const matches = scanForSensitiveContent("my number is 000-12-3456");
      expect(matches.some((m) => m.category === "ssn")).to.equal(true);
    });

    it("does not flag an ordinary entry", () => {
      expect(scanForSensitiveContent("Today I went for a walk and felt calmer.")).to.have.length(0);
    });

    it("also catches secrets typed into a reply, not just the initial entry", () => {
      const matches = scanForSensitiveContent("actually my AWS key is AKIAABCDEFGHIJKLMNOP too");
      expect(matches.some((m) => m.category === "aws_access_key")).to.equal(true);
    });
  });

  describe("Firestore isolation (rules)", function () {
    this.timeout(20000);
    let testEnv: RulesTestEnvironment;

    before(async () => {
      testEnv = await initializeTestEnvironment({
        projectId: "demo-personal-gemini-journal",
        firestore: { rules: fs.readFileSync(path.join(__dirname, "../../../firestore.rules"), "utf8") },
      });
    });

    after(async () => {
      await testEnv?.cleanup();
    });

    it("an unauthenticated read of another user's entries is denied", async () => {
      const unauthed = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(unauthed.firestore(), "users/alice/entries/e1")));
    });

    it("an authenticated user cannot read a different uid's entries", async () => {
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(getDoc(doc(bob.firestore(), "users/alice/entries/e1")));
    });

    it("no client — owner or not — can create an entry doc directly", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(setDoc(doc(alice.firestore(), "users/alice/entries/fake"), { content: "x" }));
    });

    it("no client can write directly into a conversation subcollection either", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "users/alice/entries/e1/conversation/fake"), { text: "x" })
      );
    });

    it("no client can write their own token-usage counter — that would defeat the budget entirely", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(setDoc(doc(alice.firestore(), "users/alice/usage/2026-01-01"), { tokensUsed: 0 }));
    });

    it("no client can write to another user's audit trail", async () => {
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(setDoc(doc(bob.firestore(), "users/alice/audit/fake"), { type: "x" }));
    });

    it("no client can read or write backend-only retention records", async () => {
      const alice = testEnv.authenticatedContext("alice");
      const firestore = alice.firestore();
      await assertFails(getDoc(doc(firestore, "users/alice/retentionEntries/e1")));
      await assertFails(setDoc(doc(firestore, "users/alice/retentionTurns/t1"), { text: "x" }));
    });

    it("an owner cannot read a deleted entry's conversation", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, "users/alice/entries/deleted"), {
          uid: "alice",
          createdAt: "2026-09-02T14:27:42.480Z",
          deletionState: "deleted",
        });
        await setDoc(doc(firestore, "users/alice/entries/deleted/conversation/t1"), { text: "secret" });
      });

      const alice = testEnv.authenticatedContext("alice");
      await assertFails(getDoc(doc(alice.firestore(), "users/alice/entries/deleted/conversation/t1")));
    });

    it("legacy active entries without deletionState remain readable", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const firestore = context.firestore();
        await setDoc(doc(firestore, "users/alice/entries/legacy"), {
          uid: "alice",
          createdAt: "2026-09-01T10:00:00.000Z",
        });
        await setDoc(doc(firestore, "users/alice/entries/legacy/conversation/t1"), { text: "still visible" });
      });

      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(getDoc(doc(alice.firestore(), "users/alice/entries/legacy/conversation/t1")));
    });
  });
});
