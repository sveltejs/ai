import { calculateCost, extractPricingFromGatewayModel } from "./pricing.ts";
import type { SingleTestResult, TotalCostInfo } from "./report.ts";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import type { TestDefinition } from "./test-discovery.ts";
import { TokenCache } from "./token-cache.ts";
import pRetry from "p-retry";

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

/**
 * Calculate the total cost WITHOUT any caching.
 * This represents what the cost would be if prompt caching was NOT enabled.
 * All input tokens (both inputTokens and cachedInputTokens from the API) 
 * are charged at the full input rate.
 */
export function calculateTotalCost(
  tests: SingleTestResult[],
  pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>,
): TotalCostInfo {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const test of tests) {
    for (const step of test.steps) {
      // Sum both inputTokens and cachedInputTokens to get total input tokens
      // The API reports cached tokens separately, but for non-cached cost,
      // we need to charge ALL input tokens at the full rate
      const inputTokens = step.usage.inputTokens ?? 0;
      const cachedTokens = step.usage.cachedInputTokens ?? 0;
      totalInputTokens += inputTokens + cachedTokens;
      totalOutputTokens += step.usage.outputTokens ?? 0;
    }
  }

  const costResult = calculateCost(
    pricing,
    totalInputTokens,
    totalOutputTokens,
  );

  return {
    inputCost: costResult.inputCost,
    outputCost: costResult.outputCost,
    totalCost: costResult.totalCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}

export function buildAgentPrompt(test: TestDefinition): ModelMessage[] {
  return [
    {
      role: "user",
      content: `${test.prompt}

## Test Suite

Your component must pass the following tests:

\`\`\`ts
${test.testContent}
\`\`\`

IMPORTANT: When you have finished implementing the component, use the ResultWrite tool to output your final Svelte component code. Only output the component code itself, no explanations or markdown formatting.`,
    },
  ];
}

export interface CacheSimulationResult {
  /** The simulated total cost with caching enabled */
  simulatedCostWithCache: number;
  /** Breakdown of the simulated cost */
  simulatedInputCost: number;
  simulatedOutputCost: number;
  /** Total tokens read from cache (at reduced rate) */
  cacheHits: number;
  /** Total tokens written to cache (at cache creation rate) */
  cacheWriteTokens: number;
  /** Total output tokens (unchanged from non-cached) */
  outputTokens: number;
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
): CacheSimulationResult {
  if (
    pricing.cacheReadInputTokenCost === undefined ||
    pricing.cacheCreationInputTokenCost === undefined
  ) {
    throw new Error(
      "Cache pricing is required: cacheReadInputTokenCost and cacheCreationInputTokenCost must be defined",
    );
  }
  const cacheReadRate = pricing.cacheReadInputTokenCost;
  const cacheWriteRate = pricing.cacheCreationInputTokenCost;

  let totalCacheHits = 0; // Total tokens read from cache across all steps
  let totalCacheWriteTokens = 0; // Total tokens written to cache (including step 1)
  let totalOutputTokens = 0;
  let simulatedInputCost = 0;
  let simulatedOutputCost = 0;

  for (const test of tests) {
    if (test.steps.length === 0) continue;

    const firstStep = test.steps[0];
    if (!firstStep) continue;

    // Get total input tokens for first step (inputTokens + cachedInputTokens)
    const firstStepInputTokens = 
      (firstStep.usage.inputTokens ?? 0) + (firstStep.usage.cachedInputTokens ?? 0);
    const firstStepOutputTokens = firstStep.usage.outputTokens ?? 0;

    // Create cache with first step's input tokens
    const cache = new TokenCache(firstStepInputTokens, pricing);
    totalCacheWriteTokens += firstStepInputTokens;
    totalOutputTokens += firstStepOutputTokens;

    // First step: pay cache creation rate for all input
    simulatedInputCost += firstStepInputTokens * cacheWriteRate;
    simulatedOutputCost += firstStepOutputTokens * pricing.outputCostPerToken;

    // Add output tokens for first step (but no new input tokens yet)
    cache.addMessage("step-0", 0, firstStepOutputTokens);

    // Process subsequent steps
    for (let i = 1; i < test.steps.length; i++) {
      const step = test.steps[i];
      if (!step) continue;

      // Get total input tokens for this step
      const stepInputTokens = 
        (step.usage.inputTokens ?? 0) + (step.usage.cachedInputTokens ?? 0);
      const stepOutputTokens = step.usage.outputTokens ?? 0;

      const stats = cache.getCacheStats();
      const cachedPortion = stats.currentContextTokens;
      const newTokens = Math.max(0, stepInputTokens - cachedPortion);

      totalCacheHits += cachedPortion;
      totalCacheWriteTokens += newTokens;
      totalOutputTokens += stepOutputTokens;

      // Calculate cost for this step
      simulatedInputCost += cachedPortion * cacheReadRate;
      simulatedInputCost += newTokens * cacheWriteRate;
      simulatedOutputCost += stepOutputTokens * pricing.outputCostPerToken;

      cache.addMessage(`step-${i}`, newTokens, stepOutputTokens);
    }
  }

  return {
    simulatedCostWithCache: simulatedInputCost + simulatedOutputCost,
    simulatedInputCost,
    simulatedOutputCost,
    cacheHits: totalCacheHits,
    cacheWriteTokens: totalCacheWriteTokens,
    outputTokens: totalOutputTokens,
  };
}

/**
 * Retry a function with exponential backoff using p-retry
 * Logs all errors and retry attempts to console
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    minTimeout?: number;
    factor?: number;
  } = {},
): Promise<T> {
  const { retries = 10, minTimeout = 1000, factor = 2 } = options;

  return pRetry(fn, {
    retries,
    minTimeout,
    factor,
    randomize: true,
    onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`  ⚠️  Error: ${errorMessage}`);

      const attemptDelay = minTimeout * Math.pow(factor, attemptNumber - 1);

      if (retriesLeft > 0) {
        console.log(
          `  🔄 Retrying in ~${(attemptDelay / 1000).toFixed(1)}s (attempt ${attemptNumber}/${retries + 1})...`,
        );
      } else {
        console.log(`  ✗ Max retries (${retries}) exceeded`);
      }
    },
  });
}
