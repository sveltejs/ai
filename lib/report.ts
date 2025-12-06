import { readFile, writeFile } from "node:fs/promises";

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

interface ResultData {
  steps: Step[];
  resultWriteContent?: string | null;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  let result = "";
  for (const char of text) {
    result += map[char] ?? char;
  }
  return result;
}

/**
 * Format timestamp to readable date
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Render a single content block based on its type
 */
function renderContentBlock(block: ContentBlock): string {
  if (block.type === "text") {
    return `<div class="text-block">${escapeHtml(block.text)}</div>`;
  } else if (block.type === "tool-call") {
    const inputJson = JSON.stringify(block.input, null, 2);
    return `
      <div class="tool-call-block">
        <div class="tool-header">
          <span class="tool-icon">🔧</span>
          <span class="tool-name">${escapeHtml(block.toolName)}</span>
          <span class="tool-id">${escapeHtml(block.toolCallId)}</span>
        </div>
        <details class="tool-input">
          <summary>Input Parameters</summary>
          <pre>${escapeHtml(inputJson)}</pre>
        </details>
      </div>
    `;
  } else if (block.type === "tool-result") {
    const inputJson = JSON.stringify(block.input, null, 2);
    const outputText = block.output?.content
      ? block.output.content
          .map((c) => c.text || JSON.stringify(c))
          .join("\n")
      : "No output";
    const isError = block.output?.isError || false;
    return `
      <div class="tool-result-block ${isError ? "error" : ""}">
        <div class="tool-header">
          <span class="tool-icon">${isError ? "❌" : "✓"}</span>
          <span class="tool-name">${escapeHtml(block.toolName)}</span>
          <span class="tool-id">${escapeHtml(block.toolCallId)}</span>
        </div>
        <details class="tool-input">
          <summary>Input Parameters</summary>
          <pre>${escapeHtml(inputJson)}</pre>
        </details>
        <details class="tool-output">
          <summary>Output</summary>
          <pre>${escapeHtml(outputText)}</pre>
        </details>
      </div>
    `;
  }
  return "";
}

/**
 * Generate HTML report from result data
 */
function generateHtml(data: ResultData): string {
  const stepsHtml = data.steps
    .map((step, index) => {
      const userMessage = step.request.body.messages.find(
        (m) => m.role === "user"
      );
      const userContentHtml = userMessage?.content
        .map((block) => renderContentBlock(block))
        .join("") || "<div class=\"text-block\">No prompt</div>";

      const assistantContentHtml = step.content
        .map((block) => renderContentBlock(block))
        .join("") || "<div class=\"text-block\">No response</div>";

      const timestamp = formatTimestamp(step.response.timestamp);

      return `
        <div class="step">
          <div class="step-header">
            <h2>Step ${index + 1}</h2>
            <span class="timestamp">${timestamp}</span>
          </div>

          <div class="metadata">
            <div class="meta-item">
              <span class="meta-label">Model:</span>
              <span class="meta-value">${step.response.modelId}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Finish Reason:</span>
              <span class="meta-value">${step.finishReason}</span>
            </div>
          </div>

          <div class="usage">
            <div class="usage-item">
              <span class="usage-label">Input Tokens:</span>
              <span class="usage-value">${step.usage.inputTokens.toLocaleString()}</span>
            </div>
            <div class="usage-item">
              <span class="usage-label">Output Tokens:</span>
              <span class="usage-value">${step.usage.outputTokens.toLocaleString()}</span>
            </div>
            <div class="usage-item">
              <span class="usage-label">Total Tokens:</span>
              <span class="usage-value">${step.usage.totalTokens.toLocaleString()}</span>
            </div>
            ${
              step.usage.cachedInputTokens > 0
                ? `<div class="usage-item">
                <span class="usage-label">Cached Tokens:</span>
                <span class="usage-value">${step.usage.cachedInputTokens.toLocaleString()}</span>
              </div>`
                : ""
            }
          </div>

          <div class="section">
            <h3>User Prompt</h3>
            <div class="content user-content">${userContentHtml}</div>
          </div>

          <div class="section">
            <h3>Assistant Response</h3>
            <div class="content assistant-content">${assistantContentHtml}</div>
          </div>
        </div>
      `;
    })
    .join("\n");

  const resultWriteHtml = data.resultWriteContent
    ? `
    <div class="step result-write">
      <div class="step-header">
        <h2>ResultWrite Output</h2>
      </div>
      <div class="section">
        <h3>Generated Content</h3>
        <div class="content result-content">${escapeHtml(
          data.resultWriteContent
        )}</div>
      </div>
    </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI SDK Benchmark Results</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
      color: #333;
      background-color: #f5f5f5;
      padding: 1rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      margin-bottom: 1rem;
      color: #1a1a1a;
      font-size: 1.75rem;
    }

    .step {
      background: white;
      border-radius: 6px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .step-header h2 {
      color: #2563eb;
      font-size: 1.25rem;
    }

    .timestamp {
      color: #666;
      font-size: 0.85rem;
    }

    .metadata {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
      font-size: 0.9rem;
    }

    .meta-item {
      display: flex;
      gap: 0.4rem;
    }

    .meta-label {
      font-weight: 600;
      color: #666;
    }

    .meta-value {
      color: #333;
    }

    .usage {
      display: flex;
      gap: 1.5rem;
      padding: 0.75rem;
      background-color: #f8f9fa;
      border-radius: 4px;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      font-size: 0.85rem;
    }

    .usage-item {
      display: flex;
      gap: 0.4rem;
    }

    .usage-label {
      font-weight: 600;
      color: #666;
    }

    .usage-value {
      color: #2563eb;
      font-weight: 600;
    }

    .section {
      margin-bottom: 1rem;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section h3 {
      color: #1a1a1a;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }

    .content {
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.9rem;
    }

    .user-content {
      background-color: #f0f9ff;
      border-left: 3px solid #2563eb;
      font-family: monospace;
      white-space: pre-wrap;
    }

    .assistant-content {
      background-color: #fafafa;
      border-left: 3px solid #16a34a;
      font-family: monospace;
      white-space: pre-wrap;
    }

    .result-content {
      background-color: #fffbeb;
      border-left: 3px solid #f59e0b;
      font-family: monospace;
      white-space: pre-wrap;
    }

    .result-write .step-header h2 {
      color: #f59e0b;
    }

    /* Tool block styles */
    .text-block {
      white-space: pre-wrap;
    }

    .tool-call-block,
    .tool-result-block {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 0.75rem;
      margin: 0.75rem 0;
    }

    .tool-call-block {
      border-left: 3px solid #3b82f6;
    }

    .tool-result-block {
      border-left: 3px solid #10b981;
    }

    .tool-result-block.error {
      border-left-color: #ef4444;
      background-color: #fef2f2;
    }

    .tool-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }

    .tool-icon {
      font-size: 1rem;
    }

    .tool-name {
      font-weight: 600;
      color: #1e293b;
    }

    .tool-id {
      font-size: 0.75rem;
      color: #64748b;
      font-family: monospace;
    }

    .tool-input {
      margin-top: 0.5rem;
      cursor: pointer;
    }

    .tool-input summary {
      font-size: 0.85rem;
      font-weight: 500;
      color: #475569;
      padding: 0.25rem 0;
      user-select: none;
    }

    .tool-input summary:hover {
      color: #1e293b;
    }

    .tool-input pre {
      margin-top: 0.5rem;
      padding: 0.5rem;
      background-color: #f1f5f9;
      border-radius: 3px;
      font-size: 0.8rem;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    }

    .tool-output {
      margin-top: 0.5rem;
      cursor: pointer;
    }

    .tool-output summary {
      font-size: 0.85rem;
      font-weight: 500;
      color: #475569;
      padding: 0.25rem 0;
      user-select: none;
    }

    .tool-output summary:hover {
      color: #1e293b;
    }

    .tool-output pre {
      margin-top: 0.5rem;
      padding: 0.5rem;
      background-color: #f1f5f9;
      border-radius: 3px;
      font-size: 0.8rem;
      overflow-x: auto;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    }

    @media (max-width: 768px) {
      body {
        padding: 0.75rem;
      }

      .step {
        padding: 1rem;
      }

      .metadata,
      .usage {
        flex-direction: column;
        gap: 0.4rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AI SDK Benchmark Results</h1>
    ${stepsHtml}
    ${resultWriteHtml}
  </div>
</body>
</html>`;
}

/**
 * Generate HTML report from result.json file
 * @param resultPath - Path to the result.json file
 * @param outputPath - Path where the HTML report will be saved
 */
export async function generateReport(
  resultPath: string,
  outputPath: string
): Promise<void> {
  try {
    // Read and parse the result.json file
    const jsonContent = await readFile(resultPath, "utf-8");
    const data: ResultData = JSON.parse(jsonContent);

    // Generate HTML
    const html = generateHtml(data);

    // Write the HTML file
    await writeFile(outputPath, html, "utf-8");

    console.log(`✓ Report generated successfully: ${outputPath}`);

    // Open the report in the default browser
    Bun.spawn(["open", outputPath]);
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}
