import { readFile, writeFile } from "node:fs/promises";

// Type definitions for result.json structure
interface ContentBlock {
  type: "text";
  text: string;
}

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
}

/**
 * Simple markdown-to-HTML converter
 * Handles code blocks, headers, lists, bold, italic, and inline code
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Handle code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Handle headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Handle bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Handle italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Handle inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Handle unordered lists
  html = html.replace(/^\- (.+$)/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Handle line breaks
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<pre>|<h[123]>|<ul>)/g, "$1");
  html = html.replace(/(<\/pre>|<\/h[123]>|<\/ul>)<\/p>/g, "$1");

  return html;
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
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
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
 * Generate HTML report from result data
 */
function generateHtml(data: ResultData): string {
  const stepsHtml = data.steps
    .map((step, index) => {
      const userMessage = step.request.body.messages.find((m) => m.role === "user");
      const userPrompt = userMessage?.content[0]?.text || "No prompt";
      const assistantResponse = step.content[0]?.text || "No response";
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
            <div class="content user-content">
              ${escapeHtml(userPrompt)}
            </div>
          </div>

          <div class="section">
            <h3>Assistant Response</h3>
            <div class="content assistant-content">
              ${markdownToHtml(assistantResponse)}
            </div>
          </div>
        </div>
      `;
    })
    .join("\n");

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
    }

    .assistant-content p {
      margin-bottom: 0.75rem;
    }

    .assistant-content h1,
    .assistant-content h2,
    .assistant-content h3 {
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }

    .assistant-content h1 {
      font-size: 1.35rem;
    }

    .assistant-content h2 {
      font-size: 1.2rem;
    }

    .assistant-content h3 {
      font-size: 1.05rem;
    }

    .assistant-content pre {
      background-color: #1e293b;
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.75rem 0;
    }

    .assistant-content pre code {
      font-family: "Courier New", Courier, monospace;
      font-size: 0.85rem;
      color: #e2e8f0;
      background: none;
      padding: 0;
    }

    .assistant-content p code {
      font-family: "Courier New", Courier, monospace;
      font-size: 0.85rem;
      background-color: #e5e7eb;
      padding: 0.15rem 0.35rem;
      border-radius: 3px;
      color: #dc2626;
    }

    .assistant-content ul {
      margin-left: 1.5rem;
      margin-bottom: 0.75rem;
    }

    .assistant-content li {
      margin-bottom: 0.35rem;
    }

    .assistant-content strong {
      font-weight: 600;
      color: #1a1a1a;
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
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}
