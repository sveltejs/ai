import {
  calculateCost,
  type ModelPricing,
  type CacheSimulation,
} from "./pricing.ts";
import type { SingleTestResult } from "./report.ts";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import type { TestDefinition } from "./test-discovery.ts";

export function sanitizeModelName(modelName: string) {
  return modelName.replace(/[^a-zA-Z0-9.]/g, "-");
}

export function getTimestampedFilename(
  prefix: string,
  extension: string,
  modelName?: string,
  now: Date = new Date(),
) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");

  const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  const modelSuffix = modelName ? `-${sanitizeModelName(modelName)}` : "";

  return `${prefix}-${timestamp}${modelSuffix}.${extension}`;
}

export function isHttpUrl(str: string) {
  return str.startsWith("http://") || str.startsWith("https://");
}

export function extractResultWriteContent(steps: unknown[]) {
  for (const step of steps) {
    const s = step as {
      content?: Array<{
        type: string;
        toolName?: string;
        input?: { content: string };
      }>;
    };
    if (s.content) {
      for (const content of s.content) {
        if (
          content.type === "tool-call" &&
          content.toolName === "ResultWrite"
        ) {
          return content.input?.content ?? null;
        }
      }
    }
  }
  return null;
}

export function calculateTotalCost(
  tests: SingleTestResult[],
  pricing: ModelPricing,
) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedInputTokens = 0;

  for (const test of tests) {
    for (const step of test.steps) {
      totalInputTokens += step.usage.inputTokens;
      totalOutputTokens += step.usage.outputTokens;
      totalCachedInputTokens += step.usage.cachedInputTokens ?? 0;
    }
  }

  const costResult = calculateCost(
    pricing,
    totalInputTokens,
    totalOutputTokens,
    totalCachedInputTokens,
  );

  return {
    inputCost: costResult.inputCost,
    outputCost: costResult.outputCost,
    cacheReadCost: costResult.cacheReadCost,
    cacheCreationCost: costResult.cacheCreationCost,
    totalCost: costResult.totalCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cachedInputTokens: totalCachedInputTokens,
  };
}

export function buildAgentPrompt(test: TestDefinition): ModelMessage[] {
  return [
    {
      role: "user",
      content: `${test.prompt}

IMPORTANT: When you have finished implementing the component, use the ResultWrite tool to output your final Svelte component code. Only output the component code itself, no explanations or markdown formatting.`,
    },
  ];
}

/**
 * Simulates cache savings using a growing prefix model.
 *
 * Cache behavior modeled:
 * - Each test runs in its own context (cache resets between tests)
 * - Step 1's input is written to cache (pays cache creation rate)
 * - Each subsequent step:
 *   - Previous step's full input is cached (pays cache read rate)
 *   - New tokens extend the cache (pays cache creation rate)
 * - The cache prefix grows with each step
 *
 * Example for a test with 3 steps (inputs: 1000 → 1500 → 2000):
 *   Step 1: 1000 tokens → pay cache creation for 1000
 *   Step 2: 1500 tokens → 1000 cached (read) + 500 new (creation)
 *   Step 3: 2000 tokens → 1500 cached (read) + 500 new (creation)
 */
export function simulateCacheSavings(
  tests: SingleTestResult[],
  pricing: ModelPricing,
): CacheSimulation {
  // Default rates if not specified:
  // - Cache read: 10% of input cost
  // - Cache creation: 125% of input cost (25% premium)
  const cacheReadRate =
    pricing.cacheReadInputTokenCost ?? pricing.inputCostPerToken * 0.1;
  const cacheWriteRate =
    pricing.cacheCreationInputTokenCost ?? pricing.inputCostPerToken * 1.25;

  let totalCacheableTokens = 0; // Tokens written to cache in step 1 of each test
  let totalCacheHits = 0; // Total tokens read from cache across all steps
  let totalCacheWriteTokens = 0; // Total tokens written to cache (including extensions)
  let actualCost = 0;
  let simulatedCost = 0;

  for (const test of tests) {
    if (test.steps.length === 0) continue;

    let previousInput = 0;

    for (let i = 0; i < test.steps.length; i++) {
      const step = test.steps[i];
      if (!step) continue;

      const inputTokens = step.usage.inputTokens;
      const outputTokens = step.usage.outputTokens;

      // Actual cost (no caching) - all input at full rate
      actualCost += inputTokens * pricing.inputCostPerToken;
      actualCost += outputTokens * pricing.outputCostPerToken;

      if (i === 0) {
        // First step: pay cache creation rate for all input (to prime the cache)
        simulatedCost += inputTokens * cacheWriteRate;
        totalCacheableTokens += inputTokens;
        totalCacheWriteTokens += inputTokens;
      } else {
        // Subsequent steps:
        // - Previous step's input is cached (pay cache read rate)
        // - New tokens extend the cache (pay cache creation rate)
        const cachedPortion = previousInput;
        const newPortion = Math.max(0, inputTokens - previousInput);

        simulatedCost += cachedPortion * cacheReadRate;
        simulatedCost += newPortion * cacheWriteRate;

        totalCacheHits += cachedPortion;
        totalCacheWriteTokens += newPortion;
      }

      // Output tokens always paid at full rate
      simulatedCost += outputTokens * pricing.outputCostPerToken;

      // This step's input becomes the cached prefix for the next step
      previousInput = inputTokens;
    }
  }

  return {
    simulatedCostWithCache: simulatedCost,
    cacheableTokens: totalCacheableTokens,
    cacheHits: totalCacheHits,
    cacheWriteTokens: totalCacheWriteTokens,
  };
}
