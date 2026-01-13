import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { MultiTestResultData } from "./lib/report.ts";
import { formatCost } from "./lib/pricing.ts";

interface ResultSummary {
  filename: string;
  htmlFilename: string;
  model: string;
  timestamp: string;
  score: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalCost: number | null;
  cachedCost: number | null;
  mcpEnabled: boolean;
}

function getResultSummaries(): ResultSummary[] {
  const resultsDir = "results";
  const files = readdirSync(resultsDir);

  const jsonFiles = files.filter(
    (file) => file.startsWith("result-") && file.endsWith(".json"),
  );

  const summaries: ResultSummary[] = [];

  for (const jsonFile of jsonFiles) {
    try {
      const content = readFileSync(`${resultsDir}/${jsonFile}`, "utf-8");
      const data = JSON.parse(content) as MultiTestResultData;

      const htmlFilename = jsonFile.replace(/\.json$/, ".html");

      const passedTests = data.tests.filter(
        (t) => t.verification?.passed,
      ).length;
      const failedTests = data.tests.filter(
        (t) => t.verification && !t.verification.passed,
      ).length;

      summaries.push({
        filename: jsonFile,
        htmlFilename,
        model: data.metadata.model,
        timestamp: data.metadata.timestamp,
        score: data.metadata.unitTestTotals.score,
        totalTests: data.tests.length,
        passedTests,
        failedTests,
        totalCost: data.metadata.totalCost?.totalCost ?? null,
        cachedCost: data.metadata.cacheSimulation?.simulatedCostWithCache ?? null,
        mcpEnabled: data.metadata.mcpEnabled,
      });
    } catch (error) {
      console.warn(`⚠️  Could not parse ${jsonFile}:`, error);
    }
  }

  // Sort by timestamp descending (newest first)
  summaries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return summaries;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function getScoreClass(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

function generateIndexHtml(summaries: ResultSummary[]): string {
  const rows = summaries
    .map((s) => {
      const scoreClass = getScoreClass(s.score);
      const costDisplay =
        s.totalCost !== null ? formatCost(s.totalCost) : "N/A";
      const cachedCostDisplay =
        s.cachedCost !== null ? formatCost(s.cachedCost) : "N/A";
      const mcpBadge = s.mcpEnabled
        ? '<span class="badge mcp-enabled">MCP</span>'
        : '<span class="badge mcp-disabled">No MCP</span>';

      return `
      <tr>
        <td>
          <a href="${s.htmlFilename}" class="result-link">${s.model}</a>
          ${mcpBadge}
        </td>
        <td class="timestamp">${formatTimestamp(s.timestamp)}</td>
        <td><span class="score ${scoreClass}">${s.score}%</span></td>
        <td class="tests">
          <span class="passed">${s.passedTests}</span> /
          <span class="total">${s.totalTests}</span>
        </td>
        <td class="cost">${costDisplay}</td>
        <td class="cost">${cachedCostDisplay}</td>
        <td class="actions">
          <a href="${s.htmlFilename}" class="btn btn-view">View Report</a>
          <a href="${s.filename}" class="btn btn-json">JSON</a>
        </td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SvelteBench 2.0 Results</title>
  <style>
    :root {
      --bg: #f8f8f8;
      --surface: #ffffff;
      --text: #24292e;
      --text-muted: #6a737d;
      --border: #e1e4e8;
      --primary: #0969da;
      --success: #238636;
      --warning: #9a6700;
      --error: #cf222e;
    }

    [data-theme="dark"] {
      --bg: #0d1117;
      --surface: #161b22;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --border: #30363d;
      --primary: #58a6ff;
      --success: #3fb950;
      --warning: #d29922;
      --error: #f85149;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      padding: 24px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 14px;
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

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }

    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: var(--bg);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover {
      background: rgba(88, 166, 255, 0.05);
    }

    .result-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }

    .result-link:hover {
      text-decoration: underline;
    }

    .timestamp {
      color: var(--text-muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .score {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }

    .score.excellent {
      background: var(--success);
      color: white;
    }

    .score.good {
      background: #238636;
      color: white;
    }

    .score.fair {
      background: var(--warning);
      color: white;
    }

    .score.poor {
      background: var(--error);
      color: white;
    }

    .tests .passed {
      color: var(--success);
      font-weight: 600;
    }

    .tests .total {
      color: var(--text-muted);
    }

    .cost {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--text-muted);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 8px;
      vertical-align: middle;
    }

    .mcp-enabled {
      background: var(--primary);
      color: white;
    }

    .mcp-disabled {
      background: var(--border);
      color: var(--text-muted);
    }

    .actions {
      white-space: nowrap;
    }

    .btn {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .btn-view {
      background: var(--primary);
      color: white;
    }

    .btn-view:hover {
      background: #4a94e6;
    }

    .btn-json {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      margin-left: 8px;
    }

    .btn-json:hover {
      background: var(--border);
      color: var(--text);
    }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: var(--text-muted);
    }

    .empty-state h2 {
      font-size: 20px;
      margin-bottom: 8px;
      color: var(--text);
    }

    footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    footer a {
      color: var(--primary);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      body {
        padding: 16px;
      }

      table {
        display: block;
        overflow-x: auto;
      }

      .actions .btn-json {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <h1>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#FF3E00"/>
            <path d="M24.5 8.5L16 5L7.5 8.5V15.5C7.5 20.5 11 24.5 16 26C21 24.5 24.5 20.5 24.5 15.5V8.5Z" stroke="white" stroke-width="2" fill="none"/>
            <path d="M12 16L14.5 18.5L20 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          SvelteBench 2.0
        </h1>
        <button class="theme-toggle" onclick="toggleTheme()">◐</button>
      </div>
    </header>

    ${
      summaries.length > 0
        ? `
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th>Date</th>
          <th>Score</th>
          <th>Tests</th>
          <th>Cost</th>
          <th>Cached Cost</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    `
        : `
    <div class="empty-state">
      <h2>No Results Yet</h2>
      <p>Run the benchmark to generate results that will appear here.</p>
    </div>
    `
    }

    <footer>
      <p>
        Generated by <a href="https://github.com/sveltejs/ai">SvelteBench 2.0</a> ·
        Powered by <a href="https://vercel.com/docs/ai">Vercel AI SDK</a>
      </p>
    </footer>
  </div>

  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.dataset.theme || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      html.dataset.theme = next;
      localStorage.setItem('theme', next);
    }

    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
  </script>
</body>
</html>`;
}

// Main execution
const summaries = getResultSummaries();
const html = generateIndexHtml(summaries);

writeFileSync("results/index.html", html);

console.log(`✓ Generated index.html with ${summaries.length} result(s)`);
