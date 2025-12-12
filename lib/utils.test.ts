import { describe, it, expect } from "vitest";
import {
  sanitizeModelName,
  getTimestampedFilename,
  calculateTotalCost,
} from "./utils.ts";
import type { ModelPricing } from "./pricing.ts";
import type { SingleTestResult } from "./report.ts";

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
    const result = getTimestampedFilename(
      "result",
      "json",
      undefined,
      fixedDate,
    );
    expect(result).toBe("result-2025-12-12-14-30-45.json");
  });

  it("generates filename with simple model name", () => {
    const result = getTimestampedFilename(
      "result",
      "json",
      "gpt-4o",
      fixedDate,
    );
    expect(result).toBe("result-2025-12-12-14-30-45-gpt-4o.json");
  });

  it("generates filename with model name containing slashes", () => {
    const result = getTimestampedFilename(
      "result",
      "json",
      "anthropic/claude-sonnet-4",
      fixedDate,
    );
    expect(result).toBe(
      "result-2025-12-12-14-30-45-anthropic-claude-sonnet-4.json",
    );
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
    const result = getTimestampedFilename(
      "output",
      "txt",
      "test-model",
      fixedDate,
    );
    expect(result).toBe("output-2025-12-12-14-30-45-test-model.txt");
  });

  it("pads single-digit months and days", () => {
    const earlyDate = new Date("2025-01-05T08:09:07Z");
    const result = getTimestampedFilename(
      "result",
      "json",
      undefined,
      earlyDate,
    );
    expect(result).toBe("result-2025-01-05-08-09-07.json");
  });
});

describe("calculateTotalCost", () => {
  const pricing: ModelPricing = {
    inputCostPerToken: 1.0 / 1_000_000,
    outputCostPerToken: 2.0 / 1_000_000,
    cacheReadInputTokenCost: 0.1 / 1_000_000,
  };

  it("calculates zero cost for empty results", () => {
    const tests: SingleTestResult[] = [];
    const result = calculateTotalCost(tests, pricing);

    expect(result).toEqual({
      inputCost: 0,
      outputCost: 0,
      cacheReadCost: 0,
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
  });

  it("aggregates usage from multiple steps and tests", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 100,
              outputTokens: 50,
              cachedInputTokens: 10,
            },
          } as any,
          {
            usage: {
              inputTokens: 200,
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
      {
        testName: "test2",
        prompt: "p2",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 300,
              outputTokens: 150,
              cachedInputTokens: 20,
            },
          } as any,
        ],
      },
    ];

    // Total Input: 100 + 200 + 300 = 600
    // Total Output: 50 + 100 + 150 = 300
    // Total Cached: 10 + 0 + 20 = 30
    // Uncached Input: 600 - 30 = 570

    // Costs (per Token):
    // Input: 570 * (1.0 / 1e6) = 0.00057
    // Output: 300 * (2.0 / 1e6) = 0.0006
    // Cache: 30 * (0.1 / 1e6) = 0.000003
    // Total: 0.00057 + 0.0006 + 0.000003 = 0.001173

    const result = calculateTotalCost(tests, pricing);

    expect(result).toEqual({
      inputCost: 0.00057,
      outputCost: 0.0006,
      cacheReadCost: 0.000003,
      totalCost: 0.001173,
      inputTokens: 600,
      outputTokens: 300,
      cachedInputTokens: 30,
    });
  });
});
