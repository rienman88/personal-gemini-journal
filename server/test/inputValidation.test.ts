import { expect } from "chai";
import { MAX_ENTRY_CHARS, MAX_REPLY_CHARS, readBoundedText } from "../src/lib/inputValidation";

describe("Input length validation", () => {
  it("accepts an entry at the exact limit and rejects one character over", () => {
    expect(readBoundedText("x".repeat(MAX_ENTRY_CHARS), "content", MAX_ENTRY_CHARS)).to.deep.equal({
      ok: true,
      value: "x".repeat(MAX_ENTRY_CHARS),
    });
    expect(readBoundedText("x".repeat(MAX_ENTRY_CHARS + 1), "content", MAX_ENTRY_CHARS)).to.deep.equal({
      ok: false,
      error: "content must be 8000 characters or fewer",
    });
  });

  it("accepts a reply at the exact limit and rejects one character over", () => {
    expect(readBoundedText("x".repeat(MAX_REPLY_CHARS), "text", MAX_REPLY_CHARS)).to.deep.equal({
      ok: true,
      value: "x".repeat(MAX_REPLY_CHARS),
    });
    expect(readBoundedText("x".repeat(MAX_REPLY_CHARS + 1), "text", MAX_REPLY_CHARS)).to.deep.equal({
      ok: false,
      error: "text must be 2000 characters or fewer",
    });
  });

  it("rejects empty and whitespace-only values", () => {
    expect(readBoundedText("   ", "content", MAX_ENTRY_CHARS)).to.deep.equal({
      ok: false,
      error: "content is required",
    });
  });
});
