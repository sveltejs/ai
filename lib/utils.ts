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

export function simulateCacheSavings(
  tests: SingleTestResult[],
  pricing: ModelPricing,
): CacheSimulation {
  let totalCacheableTokens = 0;
  let totalCacheHits = 0;

  // Calculate savings for each test
  for (const test of tests) {
    if (test.steps.length === 0) continue;

    // Cacheable tokens = input tokens from step 1
    const cacheableTokens = test.steps[0]?.usage.inputTokens ?? 0;
    // Cache hits = number of subsequent steps (2-N)
    const cacheHits = test.steps.length - 1;

    totalCacheableTokens += cacheableTokens;
    totalCacheHits += cacheHits;
  }

  // Calculate actual cost (no caching)
  let actualInputTokens = 0;
  let actualOutputTokens = 0;
  for (const test of tests) {
    for (const step of test.steps) {
      actualInputTokens += step.usage.inputTokens;
      actualOutputTokens += step.usage.outputTokens;
    }
  }
  const actualCost =
    actualInputTokens * pricing.inputCostPerToken +
    actualOutputTokens * pricing.outputCostPerToken;

  // Calculate simulated cost with caching
  // Cache read cost: 10% of input rate
  const cacheReadRate =
    pricing.cacheReadInputTokenCost ?? pricing.inputCostPerToken * 0.1;
  // Cache write cost: 125% of input rate (25% extra)
  const cacheWriteRate =
    pricing.cacheCreationInputTokenCost ?? pricing.inputCostPerToken * 1.25;

  // Savings from cache reads
  const cacheSavings =
    totalCacheableTokens *
    totalCacheHits *
    (pricing.inputCostPerToken - cacheReadRate);
  // Extra cost for cache writes
  const cacheWriteCost =
    totalCacheableTokens * (cacheWriteRate - pricing.inputCostPerToken);

  const simulatedCostWithCache = actualCost - cacheSavings + cacheWriteCost;
  const potentialSavings = actualCost - simulatedCostWithCache;
  const savingsPercentage =
    actualCost > 0 ? (potentialSavings / actualCost) * 100 : 0;

  return {
    actualCost,
    simulatedCostWithCache,
    potentialSavings,
    savingsPercentage,
    cacheableTokens: totalCacheableTokens,
    cacheHits: totalCacheHits,
  };
}
