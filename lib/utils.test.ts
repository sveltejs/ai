import { describe, it, expect } from "vitest";
import {
  sanitizeModelName,
  getTimestampedFilename,
  calculateTotalCost,
  simulateCacheSavings,
  buildAgentPrompt,
} from "./utils.ts";
import { TokenCache } from "./token-cache.ts";
import { extractPricingFromGatewayModel } from "./pricing.ts";
import type { SingleTestResult } from "./report.ts";
import type { TestDefinition } from "./test-discovery.ts";

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
  const pricing = {
    inputCostPerToken: 1.0 / 1_000_000,
    outputCostPerToken: 2.0 / 1_000_000,
    cacheReadInputTokenCost: 0.1 / 1_000_000,
  } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

  it("calculates zero cost for empty results", () => {
    const tests: SingleTestResult[] = [];
    const result = calculateTotalCost(tests, pricing);

    expect(result).toEqual({
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it("sums both inputTokens and cachedInputTokens for total input", () => {
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
              cachedInputTokens: 400, // Should be added to input
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
              inputTokens: 0, // All tokens reported as cached
              outputTokens: 150,
              cachedInputTokens: 300,
            },
          } as any,
        ],
      },
    ];

    // Total Input: (100 + 400) + (200 + 0) + (0 + 300) = 1000
    // Total Output: 50 + 100 + 150 = 300

    // Costs (per Token):
    // Input: 1000 * (1.0 / 1e6) = 0.001
    // Output: 300 * (2.0 / 1e6) = 0.0006
    // Total: 0.001 + 0.0006 = 0.0016

    const result = calculateTotalCost(tests, pricing);

    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(300);
    expect(result.inputCost).toBe(0.001);
    expect(result.outputCost).toBe(0.0006);
    expect(result.totalCost).toBeCloseTo(0.0016, 6);
  });

  it("handles case where all tokens are reported as cached", () => {
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
              outputTokens: 500,
              cachedInputTokens: 1000, // All input reported as cached
            },
          } as any,
        ],
      },
    ];

    const result = calculateTotalCost(tests, pricing);

    // All 1000 cached tokens should be charged at full input rate for non-cached calculation
    expect(result.inputTokens).toBe(1000);
    expect(result.inputCost).toBe(0.001); // 1000 * 1e-6
    expect(result.outputCost).toBe(0.001); // 500 * 2e-6
    expect(result.totalCost).toBe(0.002);
  });

  it("handles missing cachedInputTokens field gracefully", () => {
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
              outputTokens: 250,
              // cachedInputTokens not present
            },
          } as any,
        ],
      },
    ];

    const result = calculateTotalCost(tests, pricing);

    expect(result.inputTokens).toBe(500);
    expect(result.outputTokens).toBe(250);
  });
});

describe("TokenCache", () => {
  const pricing = {
    inputCostPerToken: 1.0 / 1_000_000,
    outputCostPerToken: 2.0 / 1_000_000,
    cacheCreationInputTokenCost: 1.25 / 1_000_000,
    cacheReadInputTokenCost: 0.1 / 1_000_000,
  } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

  it("initializes with correct values", () => {
    const cache = new TokenCache(100, pricing);
    const stats = cache.getCacheStats();

    expect(stats.totalCachedTokens).toBe(0);
    expect(stats.currentContextTokens).toBe(100);
    expect(stats.messageCount).toBe(0);
  });

  it("accumulates cached tokens correctly", () => {
    const cache = new TokenCache(100, pricing);

    cache.addMessage("What is JavaScript?", 50);
    let stats = cache.getCacheStats();
    expect(stats.totalCachedTokens).toBe(100); // 100 from initial
    expect(stats.currentContextTokens).toBe(150); // 100 + 50
    expect(stats.messageCount).toBe(1);

    cache.addMessage("JavaScript is...", 200);
    stats = cache.getCacheStats();
    expect(stats.totalCachedTokens).toBe(250); // 100 + 150
    expect(stats.currentContextTokens).toBe(350); // 150 + 200
    expect(stats.messageCount).toBe(2);

    cache.addMessage("Can you give an example?", 30);
    stats = cache.getCacheStats();
    expect(stats.totalCachedTokens).toBe(600); // 100 + 150 + 350
    expect(stats.currentContextTokens).toBe(380); // 350 + 30
    expect(stats.messageCount).toBe(3);
  });

  it("tracks output tokens separately", () => {
    const cache = new TokenCache(100, pricing);

    cache.addMessage("msg1", 50, 200);
    cache.addMessage("msg2", 30, 150);

    const stats = cache.getCacheStats();
    expect(stats.totalCachedTokens).toBe(250); // 100 + 150
    expect(stats.currentContextTokens).toBe(180); // 100 + 50 + 30
  });

  it("handles zero tokens", () => {
    const cache = new TokenCache(0, pricing);
    const stats = cache.getCacheStats();

    expect(stats.totalCachedTokens).toBe(0);
    expect(stats.currentContextTokens).toBe(0);
    expect(stats.messageCount).toBe(0);
  });
});

describe("simulateCacheSavings - growing prefix model", () => {
  // Pricing: input=$1/MTok, output=$2/MTok
  // Cache read: 10% of input = $0.10/MTok
  // Cache write: 125% of input = $1.25/MTok
  const basicPricing = {
    inputCostPerToken: 1.0 / 1_000_000,
    outputCostPerToken: 2.0 / 1_000_000,
    cacheReadInputTokenCost: 0.1 / 1_000_000,
    cacheCreationInputTokenCost: 1.25 / 1_000_000,
  } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

  it("returns zeros for empty tests array", () => {
    const tests: SingleTestResult[] = [];
    const result = simulateCacheSavings(tests, basicPricing);

    expect(result).toEqual({
      simulatedCostWithCache: 0,
      simulatedInputCost: 0,
      simulatedOutputCost: 0,
      cacheHits: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
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

    // Step 1: 1000 input tokens at cache write rate (1.25/MTok) + 500 output at $2/MTok
    // Simulated input cost = 1000 * 1.25e-6 = 0.00125
    // Simulated output cost = 500 * 2e-6 = 0.001
    // Simulated total = 0.00125 + 0.001 = 0.00225
    expect(result.cacheHits).toBe(0);
    expect(result.cacheWriteTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.simulatedInputCost).toBeCloseTo(0.00125, 6);
    expect(result.simulatedOutputCost).toBeCloseTo(0.001, 6);
    expect(result.simulatedCostWithCache).toBeCloseTo(0.00225, 6);
  });

  it("includes cachedInputTokens in total input for simulation", () => {
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
              outputTokens: 500,
              cachedInputTokens: 1000, // All tokens reported as cached
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Should use 1000 total input tokens (0 + 1000 cached)
    expect(result.cacheWriteTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.simulatedInputCost).toBeCloseTo(0.00125, 6); // 1000 * 1.25e-6
  });

  it("calculates savings for single test with multiple steps - growing prefix", () => {
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
              inputTokens: 1500,
              outputTokens: 300,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 2000,
              outputTokens: 400,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Growing prefix model:
    // Step 1: 1000 tokens → write all to cache
    //   Input cost: 1000 * 1.25e-6 = 0.00125
    //   Output cost: 200 * 2e-6 = 0.0004
    // Step 2: 1500 tokens → 1000 cached (read), 500 new (write)
    //   Input cost: 1000 * 0.1e-6 + 500 * 1.25e-6 = 0.0001 + 0.000625 = 0.000725
    //   Output cost: 300 * 2e-6 = 0.0006
    // Step 3: 2000 tokens → 1500 cached (read), 500 new (write)
    //   Input cost: 1500 * 0.1e-6 + 500 * 1.25e-6 = 0.00015 + 0.000625 = 0.000775
    //   Output cost: 400 * 2e-6 = 0.0008
    // Total input: 0.00125 + 0.000725 + 0.000775 = 0.00275
    // Total output: 0.0004 + 0.0006 + 0.0008 = 0.0018
    // Total simulated: 0.00275 + 0.0018 = 0.00455

    expect(result.cacheHits).toBe(1000 + 1500); // 1000 from step 2 + 1500 from step 3
    expect(result.cacheWriteTokens).toBe(1000 + 500 + 500); // 1000 step1 + 500 step2 + 500 step3
    expect(result.outputTokens).toBe(200 + 300 + 400);
    expect(result.simulatedCostWithCache).toBeCloseTo(0.00455, 6);
  });

  it("aggregates across multiple tests with cache reset per test", () => {
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
              inputTokens: 800,
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
              inputTokens: 600,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 900,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 1200,
              outputTokens: 200,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Test 1:
    //   Step 1: 500 write, 100 output
    //   Step 2: 500 read, 300 write, 100 output
    //   Hits: 500, Writes: 500 + 300 = 800
    //
    // Test 2:
    //   Step 1: 600 write, 200 output
    //   Step 2: 600 read, 300 write, 200 output
    //   Step 3: 900 read, 300 write, 200 output
    //   Hits: 600 + 900 = 1500, Writes: 600 + 300 + 300 = 1200

    // Total: hits = 500 + 1500 = 2000, writes = 800 + 1200 = 2000

    expect(result.cacheHits).toBe(2000);
    expect(result.cacheWriteTokens).toBe(2000);
    expect(result.outputTokens).toBe(100 + 100 + 200 + 200 + 200);

    // Calculate expected cost manually:
    // Test 1 Step 1: 500 * 1.25e-6 + 100 * 2e-6 = 0.000625 + 0.0002 = 0.000825
    // Test 1 Step 2: 500 * 0.1e-6 + 300 * 1.25e-6 + 100 * 2e-6 = 0.00005 + 0.000375 + 0.0002 = 0.000625
    // Test 2 Step 1: 600 * 1.25e-6 + 200 * 2e-6 = 0.00075 + 0.0004 = 0.00115
    // Test 2 Step 2: 600 * 0.1e-6 + 300 * 1.25e-6 + 200 * 2e-6 = 0.00006 + 0.000375 + 0.0004 = 0.000835
    // Test 2 Step 3: 900 * 0.1e-6 + 300 * 1.25e-6 + 200 * 2e-6 = 0.00009 + 0.000375 + 0.0004 = 0.000865
    // Total: 0.000825 + 0.000625 + 0.00115 + 0.000835 + 0.000865 = 0.0043

    expect(result.simulatedCostWithCache).toBeCloseTo(0.0043, 6);
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
    expect(result.cacheHits).toBe(0);
    expect(result.cacheWriteTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
  });

  it("uses custom cache pricing when provided", () => {
    const customPricing = {
      inputCostPerToken: 1.0 / 1_000_000,
      outputCostPerToken: 2.0 / 1_000_000,
      cacheReadInputTokenCost: 0.05 / 1_000_000, // 5% instead of default 10%
      cacheCreationInputTokenCost: 1.5 / 1_000_000, // 150% instead of default 125%
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

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
              inputTokens: 1500,
              outputTokens: 500,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, customPricing);

    // Step 1: 1000 write at $1.50/MTok + 500 output at $2/MTok
    //   = 1000 * 1.5e-6 + 500 * 2e-6 = 0.0015 + 0.001 = 0.0025
    // Step 2: 1000 read at $0.05/MTok + 500 write at $1.50/MTok + 500 output at $2/MTok
    //   = 1000 * 0.05e-6 + 500 * 1.5e-6 + 500 * 2e-6 = 0.00005 + 0.00075 + 0.001 = 0.0018
    // Total: 0.0025 + 0.0018 = 0.0043

    expect(result.cacheHits).toBe(1000);
    expect(result.cacheWriteTokens).toBe(1000 + 500);
    expect(result.outputTokens).toBe(500 + 500);
    expect(result.simulatedCostWithCache).toBeCloseTo(0.0043, 6);
  });

  it("handles input tokens decreasing between steps (edge case)", () => {
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
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 800, // Less than step 1 (unusual but possible)
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Step 1: 1000 write
    // Step 2: 1000 read (previous step), 0 new write (800 - 1000 = -200 → clamped to 0)
    // This tests the Math.max(0, newPortion) behavior

    expect(result.cacheHits).toBe(1000); // Still reads full previous prefix
    expect(result.cacheWriteTokens).toBe(1000); // Only step 1 writes
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
    expect(result.cacheHits).toBe(0);
    expect(result.cacheWriteTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it("compares favorably to actual cost for multi-step tests", () => {
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
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 1200,
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
          {
            usage: {
              inputTokens: 1400,
              outputTokens: 100,
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    const result = simulateCacheSavings(tests, basicPricing);

    // Actual cost (no caching):
    // Input: (1000 + 1200 + 1400) * 1e-6 = 3600 * 1e-6 = 0.0036
    // Output: (100 + 100 + 100) * 2e-6 = 300 * 2e-6 = 0.0006
    // Total actual: 0.0042

    const actualCost = 0.0042;

    // Simulated should be less than actual for multi-step scenarios
    expect(result.simulatedCostWithCache).toBeLessThan(actualCost);

    // Calculate savings
    const savings = actualCost - result.simulatedCostWithCache;
    const savingsPercent = (savings / actualCost) * 100;

    // Should have meaningful savings (>10% for this scenario)
    expect(savingsPercent).toBeGreaterThan(10);
  });

  it("throws error when cache pricing is missing", () => {
    const pricingWithoutCache = {
      inputCostPerToken: 1.0 / 1_000_000,
      outputCostPerToken: 2.0 / 1_000_000,
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

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
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    expect(() => simulateCacheSavings(tests, pricingWithoutCache)).toThrow(
      "Cache pricing is required",
    );
  });

  it("throws error when only cacheReadInputTokenCost is missing", () => {
    const pricingWithoutCacheRead = {
      inputCostPerToken: 1.0 / 1_000_000,
      outputCostPerToken: 2.0 / 1_000_000,
      cacheCreationInputTokenCost: 1.25 / 1_000_000,
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

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
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    expect(() => simulateCacheSavings(tests, pricingWithoutCacheRead)).toThrow(
      "Cache pricing is required",
    );
  });

  it("throws error when only cacheCreationInputTokenCost is missing", () => {
    const pricingWithoutCacheCreation = {
      inputCostPerToken: 1.0 / 1_000_000,
      outputCostPerToken: 2.0 / 1_000_000,
      cacheReadInputTokenCost: 0.1 / 1_000_000,
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

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
              cachedInputTokens: 0,
            },
          } as any,
        ],
      },
    ];

    expect(() => simulateCacheSavings(tests, pricingWithoutCacheCreation)).toThrow(
      "Cache pricing is required",
    );
  });
});

describe("buildAgentPrompt", () => {
  it("includes the prompt content", () => {
    const testDef: TestDefinition = {
      name: "counter",
      directory: "/path/to/tests/counter",
      referenceFile: "/path/to/tests/counter/Reference.svelte",
      componentFile: "/path/to/tests/counter/Component.svelte",
      testFile: "/path/to/tests/counter/test.ts",
      promptFile: "/path/to/tests/counter/prompt.md",
      prompt: "Create a counter component with increment and decrement buttons.",
      testContent: 'import { expect, test } from "vitest";\ntest("renders", () => {});',
    };

    const messages = buildAgentPrompt(testDef);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.content).toContain("Create a counter component with increment and decrement buttons.");
  });

  it("includes the test content in a code block", () => {
    const testDef: TestDefinition = {
      name: "hello-world",
      directory: "/path/to/tests/hello-world",
      referenceFile: "/path/to/tests/hello-world/Reference.svelte",
      componentFile: "/path/to/tests/hello-world/Component.svelte",
      testFile: "/path/to/tests/hello-world/test.ts",
      promptFile: "/path/to/tests/hello-world/prompt.md",
      prompt: "Create a hello world component.",
      testContent: 'import { expect, test } from "vitest";\nimport { render } from "@testing-library/svelte";\n\ntest("displays hello world", () => {\n  expect(true).toBe(true);\n});',
    };

    const messages = buildAgentPrompt(testDef);

    expect(messages).toHaveLength(1);
    const content = messages[0]?.content as string;

    // Must include test suite section header
    expect(content).toContain("## Test Suite");

    // Must include the test content
    expect(content).toContain('import { expect, test } from "vitest";');
    expect(content).toContain('test("displays hello world", () => {');

    // Must be in a code block
    expect(content).toContain("\`\`\`ts");
    expect(content).toMatch(/\`\`\`ts[\s\S]*import { expect, test } from "vitest";/);
  });

  it("includes instructions about ResultWrite tool", () => {
    const testDef: TestDefinition = {
      name: "simple",
      directory: "/path/to/tests/simple",
      referenceFile: "/path/to/tests/simple/Reference.svelte",
      componentFile: "/path/to/tests/simple/Component.svelte",
      testFile: "/path/to/tests/simple/test.ts",
      promptFile: "/path/to/tests/simple/prompt.md",
      prompt: "Create a simple component.",
      testContent: "test content",
    };

    const messages = buildAgentPrompt(testDef);

    expect(messages).toHaveLength(1);
    const content = messages[0]?.content as string;
    expect(content).toContain("ResultWrite tool");
    expect(content).toContain("IMPORTANT:");
  });

  it("returns ModelMessage array format", () => {
    const testDef: TestDefinition = {
      name: "test",
      directory: "/path/to/tests/test",
      referenceFile: "/path/to/tests/test/Reference.svelte",
      componentFile: "/path/to/tests/test/Component.svelte",
      testFile: "/path/to/tests/test/test.ts",
      promptFile: "/path/to/tests/test/prompt.md",
      prompt: "Test prompt",
      testContent: "Test content",
    };

    const messages = buildAgentPrompt(testDef);

    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toHaveProperty("role");
    expect(messages[0]).toHaveProperty("content");
    expect(messages[0]?.role).toBe("user");
    expect(typeof messages[0]?.content).toBe("string");
  });
});
