import { readFile, writeFile } from "node:fs/promises";
import type { TestVerificationResult } from "./output-test-runner.ts";
import { generateMultiTestHtml } from "./report-template.ts";

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
}

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

interface LegacyResultData {
  steps: Step[];
  resultWriteContent?: string | null;
  metadata?: Metadata;
}

export async function generateReport(
  resultPath: string,
  outputPath: string,
  openBrowser = true,
) {
  try {
    const jsonContent = await readFile(resultPath, "utf-8");
    const data = JSON.parse(jsonContent);

    let html;

    if ("tests" in data && Array.isArray(data.tests)) {
      html = generateMultiTestHtml(data as MultiTestResultData);
    } else {
      const legacyData = data as LegacyResultData;
      const multiTestData = {
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
