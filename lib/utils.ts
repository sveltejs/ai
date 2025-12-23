import { calculateCost, type ModelPricing } from "./pricing.ts";
import type { SingleTestResult, TotalCostInfo } from "./report.ts";
import pRetry, { type Options as PRetryOptions } from "p-retry";

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
