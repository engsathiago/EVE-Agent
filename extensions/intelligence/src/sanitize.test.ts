import { describe, expect, it } from "vitest";
import { sanitizeObject } from "./sanitize.js";

describe("intelligence trace sanitization", () => {
  it("redacts standalone provider credentials and authorization headers", () => {
    const secret = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
    const sanitized = sanitizeObject({
      prompt: `Use ${secret} with Authorization: Bearer ${secret}`,
    });

    expect(JSON.stringify(sanitized)).not.toContain(secret);
    expect(sanitized.prompt).toContain("sk-pro…wxyz");
  });
});
