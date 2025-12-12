import { calculateCost, type ModelPricing } from "./pricing.ts";
import type { SingleTestResult, TotalCostInfo } from "./report.ts";

/**
 * Sanitize model name for filesystem use
 */
export function sanitizeModelName(modelName: string): string {
  return modelName.replace(/[^a-zA-Z0-9.]/g, "-");
}

/**
 * Generate a timestamped filename with optional model name
 * Uses UTC time for consistent timestamps across timezones
 */
export function getTimestampedFilename(
  prefix: string,
  extension: string,
  modelName?: string,
  now: Date = new Date(),
): string {
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

/**
 * Check if a string is an HTTP/HTTPS URL
 */
export function isHttpUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Extract ResultWrite content from agent steps
 */
export function extractResultWriteContent(steps: unknown[]): string | null {
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
 * Calculate total cost from test results
 */
export function calculateTotalCost(
  tests: SingleTestResult[],
  pricing: ModelPricing,
): TotalCostInfo {
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
