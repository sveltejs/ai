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
 * Calculate summary statistics from result data
 */
function calculateSummary(data: ResultData): {
  totalTokens: number;
  outputTokens: number;
  stepCount: number;
  model: string;
  timestamp: string;
} {
  const totalTokens = data.steps.reduce(
    (sum, step) => sum + step.usage.totalTokens,
    0
  );
  const outputTokens = data.steps.reduce(
    (sum, step) => sum + step.usage.outputTokens,
    0
  );
  const stepCount = data.steps.length;
  const model = data.steps[0]?.response.modelId || "unknown";
  const timestamp = data.steps[0]?.response.timestamp
    ? formatTimestamp(data.steps[0].response.timestamp)
    : "";

  return { totalTokens, outputTokens, stepCount, model, timestamp };
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
    return `<div class="text">${escapeHtml(block.text)}</div>`;
  } else if (block.type === "tool-call") {
    const inputJson = JSON.stringify(block.input, null, 2);
    return `<details class="tool">
  <summary><span class="arrow">→</span> <span class="tool-name">${escapeHtml(block.toolName)}</span></summary>
  <pre class="input">${escapeHtml(inputJson)}</pre>
</details>`;
  } else if (block.type === "tool-result") {
    const outputText = block.output?.content
      ? block.output.content
          .map((c) => c.text || JSON.stringify(c))
          .join("\n")
      : "No output";
    const isError = block.output?.isError || false;
    const statusIcon = isError ? "✗" : "✓";
    return `<details class="result ${isError ? "error" : ""}">
  <summary><span class="status ${isError ? "error" : "success"}">${statusIcon}</span> Output</summary>
  <pre class="output">${escapeHtml(outputText)}</pre>
</details>`;
  }
  return "";
}

/**
 * Generate HTML report from result data
 */
function generateHtml(data: ResultData): string {
  const summary = calculateSummary(data);

  const stepsHtml = data.steps
    .map((step, index) => {
      const assistantContentHtml =
        step.content.map((block) => renderContentBlock(block)).join("") ||
        '<div class="text">No response</div>';

      const cachedInfo =
        step.usage.cachedInputTokens > 0
          ? `, ${step.usage.cachedInputTokens.toLocaleString()}⚡`
          : "";

      return `
    <details class="step">
      <summary class="step-header">
        <span class="step-num">Step ${index + 1}</span>
        <span class="line"></span>
        <span class="tokens">${step.usage.totalTokens.toLocaleString()} tok</span>
        <span class="output">(${step.usage.outputTokens.toLocaleString()}↑${cachedInfo})</span>
        <span class="reason">${step.finishReason}</span>
      </summary>
      <div class="step-content">
        ${assistantContentHtml}
      </div>
    </details>`;
    })
    .join("\n");

  const resultWriteHtml = data.resultWriteContent
    ? `
    <section class="result-write">
      <h2>Output</h2>
      <pre class="code">${escapeHtml(data.resultWriteContent)}</pre>
    </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SvelteBench 2.0</title>
  <style>
    :root {
      --bg: #f8f8f8;
      --surface: #ffffff;
      --text: #24292e;
      --text-muted: #6a737d;
      --border: #e1e4e8;
      --success: #238636;
      --error: #cf222e;
      --tool: #8250df;
    }

    [data-theme="dark"] {
      --bg: #0d1117;
      --surface: #161b22;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --border: #30363d;
      --success: #3fb950;
      --error: #f85149;
      --tool: #a371f7;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      background: var(--bg);
      color: var(--text);
      font-family: 'JetBrains Mono', 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      line-height: 1.4;
    }

    body {
      padding: 12px;
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    h1 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .theme-toggle {
      background: none;
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text);
      cursor: pointer;
      padding: 4px 8px;
      font-size: 16px;
    }

    .theme-toggle:hover {
      background: var(--border);
    }

    .step {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      list-style: none;
    }

    .step-header::-webkit-details-marker {
      display: none;
    }

    .step-header:hover {
      background: var(--bg);
    }

    .step-num {
      font-weight: 600;
    }

    .line {
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .tokens {
      color: var(--text-muted);
    }

    .output {
      color: var(--text);
    }

    .reason {
      color: var(--text-muted);
      font-size: 12px;
    }

    .step-content {
      padding: 12px;
      border-top: 1px solid var(--border);
    }

    .text {
      white-space: pre-wrap;
      margin-bottom: 8px;
      padding-left: 8px;
      border-left: 2px solid var(--border);
    }

    .tool,
    .result {
      margin: 8px 0;
      border: 1px solid var(--border);
      border-radius: 3px;
    }

    .tool summary,
    .result summary {
      padding: 4px 8px;
      cursor: pointer;
      user-select: none;
      list-style: none;
    }

    .tool summary::-webkit-details-marker,
    .result summary::-webkit-details-marker {
      display: none;
    }

    .tool summary:hover,
    .result summary:hover {
      background: var(--bg);
    }

    .arrow {
      color: var(--tool);
    }

    .tool-name {
      font-weight: 600;
    }

    .status {
      font-weight: 600;
    }

    .status.success {
      color: var(--success);
    }

    .status.error {
      color: var(--error);
    }

    .result.error {
      border-color: var(--error);
    }

    .input,
    .output {
      padding: 8px;
      background: var(--bg);
      border-top: 1px solid var(--border);
      overflow-x: auto;
      font-size: 12px;
    }

    .result-write {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
    }

    .result-write h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .code {
      padding: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      overflow-x: auto;
      font-size: 12px;
      white-space: pre-wrap;
    }

    @media (max-width: 768px) {
      body {
        padding: 8px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>SvelteBench 2.0</h1>
      <div class="meta">${summary.model} · ${summary.stepCount} steps · ${summary.totalTokens.toLocaleString()} tokens · ${summary.timestamp}</div>
    </div>
    <button class="theme-toggle" onclick="toggleTheme()">◐</button>
  </header>

  ${stepsHtml}
  ${resultWriteHtml}

  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.dataset.theme || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      html.dataset.theme = next;
      localStorage.setItem('theme', next);
    }

    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
  </script>
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
