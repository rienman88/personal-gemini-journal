/**
 * LOCAL - pure retention lifecycle tests. No emulator or network needed.
 */
import { expect } from "chai";
import { createHmac } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  buildEntryTombstone,
  buildRedactedEntry,
  buildRedactedTurn,
  hashDeletionActor,
} from "../src/lib/retention";

describe("Retention lifecycle", () => {
  const deletedAt = Timestamp.fromMillis(Date.parse("2026-09-02T14:27:42.480Z"));
  const redactAt = Timestamp.fromMillis(deletedAt.toMillis() + 30 * 24 * 60 * 60 * 1000);

  it("stores an HMAC actor identifier instead of the raw uid", () => {
    const previous = process.env.DELETION_HMAC_KEY;
    process.env.DELETION_HMAC_KEY = "test-deletion-secret";
    try {
      const uid = "t4v3FjvtnMbs1EtolpHHSU2KgOl1";
      expect(hashDeletionActor(uid)).to.equal(createHmac("sha256", "test-deletion-secret").update(uid).digest("hex"));
      expect(hashDeletionActor(uid)).to.not.include(uid);
    } finally {
      if (previous === undefined) delete process.env.DELETION_HMAC_KEY;
      else process.env.DELETION_HMAC_KEY = previous;
    }
  });

  it("builds a chain-preserving active tombstone without journal content", () => {
    const tombstone = buildEntryTombstone(
      "uid-1",
      {
        clientRequestId: "request-1",
        content: "private words",
        createdAt: "2026-09-02T14:27:42.480Z",
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
        reflection: "private reflection",
      },
      deletedAt,
      redactAt
    );

    expect(tombstone).to.include({
      uid: "uid-1",
      deletionState: "deleted",
      prevHash: "a".repeat(64),
      hash: "b".repeat(64),
    });
    expect(tombstone).to.not.have.property("content");
    expect(tombstone).to.not.have.property("reflection");
    expect(tombstone).to.not.have.property("summary");
    expect(tombstone).to.not.have.property("topics");
  });

  it("redacts retained entry material while preserving minimal audit and chain metadata", () => {
    const redacted = buildRedactedEntry(
      "uid-1",
      "entry-1",
      {
        createdAt: "2026-09-02T14:27:42.480Z",
        deletedAt,
        deletedByUidHash: "c".repeat(64),
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
        content: "private words",
        reflection: "private reflection",
        summary: "private summary",
        topics: ["private topic"],
        categories: ["work"],
        piiDetected: ["email"],
      },
      redactAt
    );

    expect(redacted).to.include({
      uid: "uid-1",
      entryId: "entry-1",
      retentionState: "redacted",
      content: "Deleted",
      reflection: "Deleted",
      summary: "Deleted",
      prevHash: "a".repeat(64),
      hash: "b".repeat(64),
    });
    expect(redacted.topics).to.deep.equal([]);
    expect(redacted.piiDetected).to.deep.equal([]);
    expect(redacted).to.not.have.property("categories");
  });

  it("redacts conversation text but keeps turn ordering and hash metadata", () => {
    const redacted = buildRedactedTurn(
      "uid-1",
      "entry-1",
      "turn-1",
      {
        role: "user",
        text: "private reply",
        createdAt: "2026-09-02T14:30:00.000Z",
        deletedAt,
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
      },
      redactAt
    );

    expect(redacted).to.include({
      uid: "uid-1",
      entryId: "entry-1",
      turnId: "turn-1",
      role: "user",
      text: "Deleted",
      retentionState: "redacted",
      prevHash: "a".repeat(64),
      hash: "b".repeat(64),
    });
  });
});
