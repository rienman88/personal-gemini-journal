import { expect } from "chai";
import {
  MAX_AI_ENTRY_CHARS,
  MAX_PRIVATE_ENTRY_CHARS,
  MAX_AI_REPLY_CHARS,
  MAX_PRIVATE_NOTE_CHARS,
  readBoundedText,
} from "../src/lib/inputValidation";

describe("Input length validation", () => {
  it("enforces the AI Journal entry limit", () => {
    expect(readBoundedText("x".repeat(MAX_AI_ENTRY_CHARS), "content", MAX_AI_ENTRY_CHARS)).to.deep.equal({
      ok: true,
      value: "x".repeat(MAX_AI_ENTRY_CHARS),
    });
    expect(readBoundedText("x".repeat(MAX_AI_ENTRY_CHARS + 1), "content", MAX_AI_ENTRY_CHARS)).to.deep.equal({
      ok: false,
      error: "content must be 3000 characters or fewer",
    });
  });

  it("enforces the Private Journal entry limit", () => {
    expect(readBoundedText("x".repeat(MAX_PRIVATE_ENTRY_CHARS), "content", MAX_PRIVATE_ENTRY_CHARS)).to.deep.equal({
      ok: true,
      value: "x".repeat(MAX_PRIVATE_ENTRY_CHARS),
    });
    expect(readBoundedText("x".repeat(MAX_PRIVATE_ENTRY_CHARS + 1), "content", MAX_PRIVATE_ENTRY_CHARS)).to.deep.equal({
      ok: false,
      error: "content must be 4000 characters or fewer",
    });
  });

  it("enforces the AI Journal reply limit", () => {
    expect(readBoundedText("x".repeat(MAX_AI_REPLY_CHARS), "text", MAX_AI_REPLY_CHARS)).to.deep.equal({
      ok: true,
      value: "x".repeat(MAX_AI_REPLY_CHARS),
    });
    expect(readBoundedText("x".repeat(MAX_AI_REPLY_CHARS + 1), "text", MAX_AI_REPLY_CHARS)).to.deep.equal({
      ok: false,
      error: "text must be 1500 characters or fewer",
    });
  });

  it("enforces the Private Journal note limit", () => {
    expect(readBoundedText("x".repeat(MAX_PRIVATE_NOTE_CHARS), "private note", MAX_PRIVATE_NOTE_CHARS)).to.deep.equal({
      ok: true,
      value: "x".repeat(MAX_PRIVATE_NOTE_CHARS),
    });
    expect(readBoundedText("x".repeat(MAX_PRIVATE_NOTE_CHARS + 1), "private note", MAX_PRIVATE_NOTE_CHARS)).to.deep.equal({
      ok: false,
      error: "private note must be 1000 characters or fewer",
    });
  });

  it("rejects empty and whitespace-only values", () => {
    expect(readBoundedText("   ", "content", MAX_AI_ENTRY_CHARS)).to.deep.equal({
      ok: false,
      error: "content is required",
    });
  });
});
