import { describe, it, expect } from "vitest";
import { sanitizeModelName, getTimestampedFilename } from "./utils.ts";

describe("sanitizeModelName", () => {
  it("replaces slashes with dashes", () => {
    expect(sanitizeModelName("anthropic/claude-sonnet-4")).toBe(
      "anthropic-claude-sonnet-4",
    );
  });

  it("replaces special characters with dashes", () => {
    expect(sanitizeModelName("model@version")).toBe("model-version");
    expect(sanitizeModelName("model_name")).toBe("model-name");
    expect(sanitizeModelName("model name")).toBe("model-name");
  });

  it("preserves dots", () => {
    expect(sanitizeModelName("gpt-4.0")).toBe("gpt-4.0");
    expect(sanitizeModelName("model.v1.2.3")).toBe("model.v1.2.3");
  });

  it("preserves alphanumeric characters", () => {
    expect(sanitizeModelName("gpt4o")).toBe("gpt4o");
    expect(sanitizeModelName("claude3")).toBe("claude3");
  });

  it("handles multiple consecutive special characters", () => {
    expect(sanitizeModelName("model///name")).toBe("model---name");
    expect(sanitizeModelName("model@#$name")).toBe("model---name");
  });
});

describe("getTimestampedFilename", () => {
  const fixedDate = new Date("2025-12-12T14:30:45Z");

  it("generates filename without model name", () => {
    const result = getTimestampedFilename("result", "json", undefined, fixedDate);
    expect(result).toBe("result-2025-12-12-14-30-45.json");
  });

  it("generates filename with simple model name", () => {
    const result = getTimestampedFilename("result", "json", "gpt-4o", fixedDate);
    expect(result).toBe("result-2025-12-12-14-30-45-gpt-4o.json");
  });

  it("generates filename with model name containing slashes", () => {
    const result = getTimestampedFilename(
      "result",
      "json",
      "anthropic/claude-sonnet-4",
      fixedDate,
    );
    expect(result).toBe("result-2025-12-12-14-30-45-anthropic-claude-sonnet-4.json");
  });

  it("generates filename with model name containing special characters", () => {
    const result = getTimestampedFilename(
      "result",
      "html",
      "model@v1.2.3",
      fixedDate,
    );
    expect(result).toBe("result-2025-12-12-14-30-45-model-v1.2.3.html");
  });

  it("handles different file extensions", () => {
    const result = getTimestampedFilename("output", "txt", "test-model", fixedDate);
    expect(result).toBe("output-2025-12-12-14-30-45-test-model.txt");
  });

  it("pads single-digit months and days", () => {
    const earlyDate = new Date("2025-01-05T08:09:07Z");
    const result = getTimestampedFilename("result", "json", undefined, earlyDate);
    expect(result).toBe("result-2025-01-05-08-09-07.json");
  });
});
