import { readFile, writeFile } from "node:fs/promises";
import type { TestVerificationResult } from "./output-test-runner.ts";
import type { ValidationResult } from "./validator-runner.ts";
import { generateMultiTestHtml } from "./report-template.ts";
import type { simulateCacheSavings } from "./utils.ts";

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolCallBlock {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  dynamic?: boolean;
}

interface ToolResultBlock {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: {
    content: Array<{ type: string; text?: string; [key: string]: unknown }>;
    isError?: boolean;
  };
  dynamic?: boolean;
}

type ContentBlock = TextBlock | ToolCallBlock | ToolResultBlock;

interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
}

interface RequestBody {
  model: string;
  max_tokens: number;
  messages: Message[];
}

interface ResponseBody {
  id: string;
  timestamp: string;
  modelId: string;
  [key: string]: unknown;
}

interface Step {
  content: ContentBlock[];
  finishReason: string;
  usage: Usage;
  request: {
    body: RequestBody;
  };
  response: ResponseBody;
  [key: string]: unknown;
}

export interface PricingInfo {
  inputCostPerMTok: number;
  outputCostPerMTok: number;
  cacheReadCostPerMTok?: number;
  cacheCreationCostPerMTok?: number;
}

export interface TotalCostInfo {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface UnitTestTotals {
  total: number;
  passed: number;
  failed: number;
  score: number;
}

interface Metadata {
  mcpEnabled: boolean;
  mcpServerUrl: string | null;
  mcpTransportType?: string | null;
  timestamp: string;
  model: string;
  pricingKey?: string | null;
  pricing?: PricingInfo | null;
  totalCost?: TotalCostInfo | null;
  cacheSimulation?: ReturnType<typeof simulateCacheSavings> | null;
  unitTestTotals: UnitTestTotals;
}

export interface SingleTestResult {
  testName: string;
  prompt: string;
  steps: Step[];
  resultWriteContent: string | null;
  verification: TestVerificationResult | null;
}

export interface MultiTestResultData {
  tests: SingleTestResult[];
  metadata: Metadata;
}

/**
 * Calculate the score as a percentage of passed unit tests.
 * Score = (passed / total) * 100, rounded to nearest integer.
 * Returns 0 if no tests were run.
 */
export function calculateScore(passed: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((passed / total) * 100);
}

/**
 * Calculate unit test totals from test results.
 * If a test's validation failed, all its unit tests are counted as failed
 * regardless of actual test results (passed = 0, failed = numTests).
 */
export function calculateUnitTestTotals(tests: SingleTestResult[]): UnitTestTotals {
  let total = 0;
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    if (test.verification) {
      total += test.verification.numTests;

      // If validation failed, count all tests as failed regardless of actual results
      if (test.verification.validationFailed) {
        failed += test.verification.numTests;
      } else {
        passed += test.verification.numPassed;
        failed += test.verification.numFailed;
      }
    }
  }

  const score = calculateScore(passed, total);

  return { total, passed, failed, score };
}

export async function generateReport(
  resultPath: string,
  outputPath: string,
  openBrowser = true,
) {
  try {
    const jsonContent = await readFile(resultPath, "utf-8");
    const data = JSON.parse(jsonContent) as MultiTestResultData;

    const html = generateMultiTestHtml(data);

    await writeFile(outputPath, html, "utf-8");

    console.log(`✓ Report generated successfully: ${outputPath}`);

    if (openBrowser) {
      Bun.spawn(["open", outputPath]);
    }
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}
