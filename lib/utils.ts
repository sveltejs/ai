import { calculateCost, type ModelPricing } from "./pricing.ts";
import type { SingleTestResult, TotalCostInfo } from "./report.ts";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import type { TestDefinition } from "./test-discovery.ts";

export function sanitizeModelName(modelName: string): string {
  return modelName.replace(/[^a-zA-Z0-9.]/g, "-");
}

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

export function isHttpUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

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

export function buildAgentPrompt(test: TestDefinition): ModelMessage[] {
  return [
    {
      role: "user",
      content: `${test.prompt}

IMPORTANT: When you have finished implementing the component, use the ResultWrite tool to output your final Svelte component code. Only output the component code itself, no explanations or markdown formatting.`,
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      },
    },
  ];
}
