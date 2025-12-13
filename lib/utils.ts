import { calculateCost, extractPricingFromGatewayModel } from "./pricing.ts";
import type { SingleTestResult } from "./report.ts";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import type { TestDefinition } from "./test-discovery.ts";
import { TokenCache } from "./token-cache.ts";

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
  pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>,
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
  pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>,
) {
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
  let simulatedCost = 0;

  for (const test of tests) {
    if (test.steps.length === 0) continue;

    const firstStep = test.steps[0];
    if (!firstStep) continue;

    // Create cache with first step's input tokens
    const cache = new TokenCache(firstStep.usage.inputTokens, pricing);
    totalCacheableTokens += firstStep.usage.inputTokens;
    totalCacheWriteTokens += firstStep.usage.inputTokens;

    // First step: pay cache creation rate for all input
    simulatedCost += firstStep.usage.inputTokens * cacheWriteRate;
    simulatedCost += firstStep.usage.outputTokens * pricing.outputCostPerToken;

    // Add output tokens for first step (but no new input tokens yet)
    cache.addMessage("step-0", 0, firstStep.usage.outputTokens);

    // Process subsequent steps
    for (let i = 1; i < test.steps.length; i++) {
      const step = test.steps[i];
      if (!step) continue;

      const stats = cache.getCacheStats();
      const cachedPortion = stats.currentContextTokens;
      const newTokens = Math.max(0, step.usage.inputTokens - cachedPortion);

      totalCacheHits += cachedPortion;
      totalCacheWriteTokens += newTokens;

      // Calculate cost for this step
      simulatedCost += cachedPortion * cacheReadRate;
      simulatedCost += newTokens * cacheWriteRate;
      simulatedCost += step.usage.outputTokens * pricing.outputCostPerToken;

      cache.addMessage(`step-${i}`, newTokens, step.usage.outputTokens);
    }
  }

  return {
    simulatedCostWithCache: simulatedCost,
    cacheableTokens: totalCacheableTokens,
    cacheHits: totalCacheHits,
    cacheWriteTokens: totalCacheWriteTokens,
  };
}
