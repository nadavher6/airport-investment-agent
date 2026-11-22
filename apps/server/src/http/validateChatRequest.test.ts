import { describe, expect, it } from "vitest";
import { HttpError } from "./errors.ts";
import { validateChatRequest } from "./validateChatRequest.ts";

const valid = { modelId: "gemini-3.5-flash", messages: [{ role: "user", content: "Hello" }] };

function rejectionOf(body: unknown): string {
  try {
    validateChatRequest(body);
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe("bad_request");
    return (err as HttpError).message;
  }
  throw new Error("expected validateChatRequest to throw");
}

describe("validateChatRequest", () => {
  it("accepts a valid request and keeps the turns", () => {
    const history = {
      modelId: "m",
      messages: [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ],
    };
    expect(validateChatRequest(history)).toEqual(history);
  });

  // Regression: a reply cancelled before any text flattens to "" and used to wedge the chat with 400s.
  it("accepts an empty assistant turn in the history", () => {
    const history = {
      modelId: "m",
      messages: [
        { role: "user", content: "rank airports" },
        { role: "assistant", content: "" },
        { role: "user", content: "continue" },
      ],
    };
    expect(validateChatRequest(history)).toEqual(history);
  });

  it("drops unknown fields from turns", () => {
    const result = validateChatRequest({
      modelId: "m",
      messages: [{ role: "user", content: "hi", extra: true }],
    });
    expect(result.messages[0]).toEqual({ role: "user", content: "hi" });
  });

  it.each([
    ["null body", null, "Body must be a JSON object"],
    ["array body", [], "Body must be a JSON object"],
    ["missing modelId", { messages: valid.messages }, "modelId must be a non-empty string"],
    ["empty modelId", { ...valid, modelId: "" }, "modelId must be a non-empty string"],
    ["missing messages", { modelId: "m" }, "messages must be a non-empty array"],
    ["empty messages", { modelId: "m", messages: [] }, "messages must be a non-empty array"],
    ["turn not an object", { modelId: "m", messages: ["hi"] }, "messages[0] must be an object"],
    ["bad role", { modelId: "m", messages: [{ role: "system", content: "x" }] }, 'messages[0].role must be "user" or "assistant"'],
    ["blank content", { modelId: "m", messages: [{ role: "user", content: "   " }] }, "messages[0].content must be a non-empty string"],
    ["non-string content", { modelId: "m", messages: [{ role: "user", content: 42 }] }, "messages[0].content must be a string"],
    [
      "non-string assistant content",
      { modelId: "m", messages: [{ role: "assistant", content: null }, { role: "user", content: "q" }] },
      "messages[0].content must be a string",
    ],
    [
      "last turn from assistant",
      { modelId: "m", messages: [{ role: "user", content: "q" }, { role: "assistant", content: "a" }] },
      'The last message must have role "user"',
    ],
  ])("rejects %s", (_name, body, message) => {
    expect(rejectionOf(body)).toBe(message);
  });

  it("rejects content over the length limit", () => {
    const body = { modelId: "m", messages: [{ role: "user", content: "x".repeat(20_001) }] };
    expect(rejectionOf(body)).toMatch(/exceeds 20000 characters/);
  });

  it("rejects too many turns", () => {
    const messages = Array.from({ length: 101 }, () => ({ role: "user", content: "x" }));
    expect(rejectionOf({ modelId: "m", messages })).toMatch(/at most 100 turns/);
  });

  it("keeps a valid conversationId and leaves it out when absent (#50)", () => {
    expect(validateChatRequest({ ...valid, conversationId: "3f1c2a7e-9b1d-4c1e-8f00-1234abcd5678" }).conversationId).toBe(
      "3f1c2a7e-9b1d-4c1e-8f00-1234abcd5678",
    );
    expect("conversationId" in validateChatRequest(valid)).toBe(false);
  });

  it("accepts a UUID and the 32-hex fallback format as conversationId (#50)", () => {
    for (const id of ["3f1c2a7e-9b1d-4c1e-8f00-1234abcd5678", "0123456789abcdef0123456789abcdef", "x".repeat(16), "x".repeat(64)]) {
      expect(validateChatRequest({ ...valid, conversationId: id }).conversationId).toBe(id);
    }
  });

  it("rejects a conversationId that is short, too long, has bad characters or is not a string (#50)", () => {
    const bad = [42, "", "a", "x".repeat(15), "x".repeat(65), "a b".padEnd(20, "x"), "../etc/passwd/../x", "x".repeat(15) + ".", { id: "x" }, null];
    for (const conversationId of bad) {
      expect(rejectionOf({ ...valid, conversationId })).toMatch(/conversationId must be 16-64 characters/);
    }
  });
});
