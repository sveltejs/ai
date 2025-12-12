import { describe, it, expect } from "vitest";
import {
  sanitizeModelName,
  getTimestampedFilename,
  calculateTotalCost,
  simulateCacheSavings,
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

describe("simulateCacheSavings", () => {
  const basicPricing: ModelPricing = {
    inputCostPerToken: 1.0 / 1_000_000,
    outputCostPerToken: 2.0 / 1_000_000,
  };

  it("returns zeros for empty tests array", () => {
    const tests: SingleTestResult[] = [];
    const result = simulateCacheSavings(tests, basicPricing);

    expect(result).toEqual({
      simulatedCostWithCache: 0,
      cacheableTokens: 0,
      cacheHits: 0,
    });
  });

  it("handles single test with single step (no cache hits)", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 500,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // With only 1 step, there are 0 cache hits
    // Cacheable tokens = 1000
    // Cache hits = 0
    // Actual cost = (1000 * 1e-6) + (500 * 2e-6) = 0.001 + 0.001 = 0.002
    // Cache write cost = 1000 * (1.25e-6 - 1e-6) = 1000 * 0.25e-6 = 0.00025
    // Cache savings = 1000 * 0 * (1e-6 - 0.1e-6) = 0
    // Simulated cost = 0.002 - 0 + 0.00025 = 0.00225
    // Potential savings = 0.002 - 0.00225 = -0.00025 (negative savings)
    // Savings percentage = -0.00025 / 0.002 * 100 = -12.5

    expect(result.cacheableTokens).toBe(1000);
    expect(result.cacheHits).toBe(0);
    expect(result.simulatedCostWithCache).toBeCloseTo(0.00225, 6);
  });

  it("calculates savings for single test with multiple steps", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 300,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 400,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Cacheable tokens = 1000 (from step 1)
    // Cache hits = 2 (steps 2 and 3)
    // Actual cost = (3000 * 1e-6) + (900 * 2e-6) = 0.003 + 0.0018 = 0.0048
    // Cache read rate = 0.1 * 1e-6
    // Cache write rate = 1.25 * 1e-6
    // Cache savings = 1000 * 2 * (1e-6 - 0.1e-6) = 2000 * 0.9e-6 = 0.0018
    // Cache write cost = 1000 * (1.25e-6 - 1e-6) = 1000 * 0.25e-6 = 0.00025
    // Simulated cost = 0.0048 - 0.0018 + 0.00025 = 0.00325
    // Potential savings = 0.0048 - 0.00325 = 0.00155
    // Savings percentage = 0.00155 / 0.0048 * 100 = 32.291...

    expect(result.cacheableTokens).toBe(1000);
    expect(result.cacheHits).toBe(2);
    expect(result.simulatedCostWithCache).toBeCloseTo(0.00325, 6);
  });

  it("aggregates across multiple tests", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 500,
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 500,
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
              inputTokens: 800,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 800,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 800,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Test 1: cacheable = 500, hits = 1
    // Test 2: cacheable = 800, hits = 2
    // Total cacheable = 1300, total hits = 3
    expect(result.cacheableTokens).toBe(1300);
    expect(result.cacheHits).toBe(3);

    // Cache savings = 1300 * 3 * (1e-6 - 0.1e-6) = 3900 * 0.9e-6 = 0.00351
    // Cache write cost = 1300 * 0.25e-6 = 0.000325
    // Simulated cost = 0.0050 - 0.00351 + 0.000325 = 0.001815
    expect(result.simulatedCostWithCache).toBeCloseTo(0.001815, 6);
  });

  it("skips tests with empty steps array", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [],
      },
      {
        testName: "test2",
        prompt: "p2",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 500,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Only test2 should be counted
    expect(result.cacheableTokens).toBe(1000);
    expect(result.cacheHits).toBe(0);
  });

  it("uses custom cache pricing when provided", () => {
    const customPricing: ModelPricing = {
      inputCostPerToken: 1.0 / 1_000_000,
      outputCostPerToken: 2.0 / 1_000_000,
      cacheReadInputTokenCost: 0.05 / 1_000_000, // 5% instead of default 10%
      cacheCreationInputTokenCost: 1.5 / 1_000_000, // 150% instead of default 125%
    };

    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 500,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 1000,
              outputTokens: 500,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, customPricing);

    // Cacheable = 1000, hits = 1
    // Actual cost = (2000 * 1e-6) + (1000 * 2e-6) = 0.002 + 0.002 = 0.004
    // Cache read rate = 0.05e-6 (custom)
    // Cache write rate = 1.5e-6 (custom)
    // Cache savings = 1000 * 1 * (1e-6 - 0.05e-6) = 1000 * 0.95e-6 = 0.00095
    // Cache write cost = 1000 * (1.5e-6 - 1e-6) = 1000 * 0.5e-6 = 0.0005
    // Simulated cost = 0.004 - 0.00095 + 0.0005 = 0.00355

    expect(result.simulatedCostWithCache).toBeCloseTo(0.00355, 6);
  });

  it("handles zero actual cost edge case", () => {
    const tests: SingleTestResult[] = [
      {
        testName: "test1",
        prompt: "p1",
        resultWriteContent: null,
        verification: {} as any,
        steps: [
          {
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    expect(result.simulatedCostWithCache).toBe(0);
  });
});
