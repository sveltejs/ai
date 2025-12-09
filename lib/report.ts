import { readFile, writeFile } from "node:fs/promises";
import type { TestVerificationResult } from "./output-test-runner.ts";
import { generateMultiTestHtml } from "./report-template.ts";

// Type definitions for result.json structure
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

/**
 * Pricing information embedded in metadata
 */
export interface PricingInfo {
  inputCostPerMTok: number;
  outputCostPerMTok: number;
  cacheReadCostPerMTok?: number;
}

/**
 * Total cost calculation for a test run
 */
export interface TotalCostInfo {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
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
}

// Single test result within a multi-test run
export interface SingleTestResult {
  testName: string;
  prompt: string;
  steps: Step[];
  resultWriteContent: string | null;
  verification: TestVerificationResult | null;
}

// Multi-test result data structure
export interface MultiTestResultData {
  tests: SingleTestResult[];
  metadata: Metadata;
}

// Legacy single-test result data structure (for backward compatibility)
interface LegacyResultData {
  steps: Step[];
  resultWriteContent?: string | null;
  metadata?: Metadata;
}

/**
 * Generate HTML report from result.json file
 * Supports both legacy single-test and new multi-test formats
 * @param resultPath - Path to the result.json file
 * @param outputPath - Path where the HTML report will be saved
 * @param openBrowser - Whether to open the report in the default browser (default: true)
 */
export async function generateReport(
  resultPath: string,
  outputPath: string,
  openBrowser = true,
): Promise<void> {
  try {
    // Read and parse the result.json file
    const jsonContent = await readFile(resultPath, "utf-8");
    const data = JSON.parse(jsonContent);

    let html: string;

    // Check if it's the new multi-test format
    if ("tests" in data && Array.isArray(data.tests)) {
      html = generateMultiTestHtml(data as MultiTestResultData);
    } else {
      // Legacy format - convert to multi-test format for consistent rendering
      const legacyData = data as LegacyResultData;
      const multiTestData: MultiTestResultData = {
        tests: [
          {
            testName: "Legacy Test",
            prompt: "Static prompt (legacy format)",
            steps: legacyData.steps,
            resultWriteContent: legacyData.resultWriteContent ?? null,
            verification: null,
          },
        ],
        metadata: legacyData.metadata ?? {
          mcpEnabled: false,
          mcpServerUrl: null,
          timestamp: new Date().toISOString(),
          model: "unknown",
        },
      };
      html = generateMultiTestHtml(multiTestData);
    }

    // Write the HTML file
    await writeFile(outputPath, html, "utf-8");

    console.log(`✓ Report generated successfully: ${outputPath}`);

    // Open the report in the default browser
    if (openBrowser) {
      Bun.spawn(["open", outputPath]);
    }
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}
