import type { TestVerificationResult } from "./output-test-runner.ts";
import type { ValidationResult } from "./validator-runner.ts";
import type {
  MultiTestResultData,
  SingleTestResult,
  UnitTestTotals,
} from "./report.ts";
import { getReportStyles } from "./report-styles.ts";
import { formatCost, formatMTokCost } from "./pricing.ts";
import { createHighlighter, type Highlighter } from "shiki";

const highlighter = await createHighlighter({
  themes: ["github-light", "github-dark"],
  langs: ["svelte"],
});

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

interface Step {
  content: ContentBlock[];
  finishReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
  };
  [key: string]: unknown;
}

function escapeHtml(text: string) {
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

function formatTimestamp(timestamp: string) {
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

function getFirstLines(code: string, numLines: number) {
  const lines = code.split("\n");
  return lines.slice(0, numLines).join("\n");
}

function renderContentBlock(block: ContentBlock) {
  if (block.type === "text") {
    return `<div class="text">${escapeHtml(block.text)}</div>`;
  } else if (block.type === "tool-call") {
    const inputJson = JSON.stringify(block.input, null, 2);
    return `<details class="tool">
  <summary><span class="arrow">→</span> <span class="tool-name">${escapeHtml(block.toolName)}</span></summary>
  <pre class="input">${escapeHtml(inputJson)}</pre>
</details>`;
  } else if (block.type === "tool-result") {
    const outputText = JSON.stringify(block.output, null, 2);
    const isError =
      block.output &&
      typeof block.output === "object" &&
      "error" in block.output;
    const statusIcon = isError ? "✗" : "✓";
    return `<details class="result ${isError ? "error" : ""}">
  <summary><span class="status ${isError ? "error" : "success"}">${statusIcon}</span> Output</summary>
  <pre class="output">${escapeHtml(outputText)}</pre>
</details>`;
  }
  return "";
}

function renderValidationResult(
  validation: ValidationResult | null | undefined,
) {
  if (!validation) {
    return "";
  }

  const statusClass = validation.valid ? "passed" : "failed";
  const statusIcon = validation.valid ? "✓" : "✗";
  const statusText = validation.valid
    ? "Validation passed"
    : "Validation failed";

  let errorsHtml = "";
  if (validation.errors && validation.errors.length > 0) {
    const errorItems = validation.errors
      .map((err) => `<li class="validation-error-item">${escapeHtml(err)}</li>`)
      .join("");
    errorsHtml = `<ul class="validation-errors">${errorItems}</ul>`;
  }

  return `<div class="validation-result ${statusClass}">
    <div class="validation-header">
      <span class="validation-icon">${statusIcon}</span>
      <span class="validation-text">${statusText}</span>
    </div>
    ${errorsHtml}
  </div>`;
}

function renderVerificationResult(verification: TestVerificationResult | null) {
  if (!verification) {
    return `<div class="verification-result skipped">
      <span class="verification-icon">⊘</span>
      <span class="verification-text">Test verification not run</span>
    </div>`;
  }

  const validationHtml = verification.validation
    ? `<div class="validation-section">
        <h5>Code Validation</h5>
        ${renderValidationResult(verification.validation)}
      </div>`
    : "";

  // When validation fails, report 0 passed regardless of actual results
  const reportedPassed = verification.validationFailed ? 0 : verification.numPassed;

  // Determine status class and icon based on validation and test results
  const statusClass = verification.validationFailed
    ? "failed"
    : verification.passed
      ? "passed"
      : "failed";
  const statusIcon = verification.validationFailed
    ? "⊘"
    : verification.passed
      ? "✓"
      : "✗";
  const statusText = verification.validationFailed
    ? `Validation failed (0/${verification.numTests} tests counted as passed)`
    : verification.passed
      ? "All tests passed"
      : "Tests failed";

  let failedTestsHtml = "";
  if (verification.failedTests && verification.failedTests.length > 0) {
    const failedItems = verification.failedTests
      .map(
        (ft) => `<li class="failed-test">
          <div class="failed-test-name">${escapeHtml(ft.fullName)}</div>
          <pre class="failed-test-error">${escapeHtml(ft.errorMessage)}</pre>
        </li>`,
      )
      .join("");
    failedTestsHtml = `<details class="failed-tests-details">
      <summary>Failed Tests (${verification.failedTests.length})</summary>
      <ul class="failed-tests-list">${failedItems}</ul>
    </details>`;
  }

  let errorHtml = "";
  if (verification.error) {
    errorHtml = `<div class="verification-error">Error: ${escapeHtml(verification.error)}</div>`;
  }

  return `${validationHtml}
  <div class="verification-result ${statusClass}">
    <div class="verification-header">
      <span class="verification-icon">${statusIcon}</span>
      <span class="verification-text">${statusText}</span>
      <span class="verification-stats">${reportedPassed}/${verification.numTests} tests (${verification.duration}ms)</span>
    </div>
    ${errorHtml}
    ${failedTestsHtml}
  </div>`;
}

function renderSteps(steps: Step[]) {
  return steps
    .map((step, index) => {
      const assistantContentHtml =
        step.content.map((block) => renderContentBlock(block)).join("") ||
        '<div class="text">No response</div>';

      const cachedInfo =
        step.usage.cachedInputTokens > 0
          ? `, ${step.usage.cachedInputTokens.toLocaleString()}⚡`
          : "";

      const inputTokens = step.usage.inputTokens;
      const cachedTokens = step.usage.cachedInputTokens;
      const uncachedInputTokens = inputTokens - cachedTokens;

      return `
    <details class="step">
      <summary class="step-header">
        <span class="step-num">Step ${index + 1}</span>
        <span class="line"></span>
        <span class="tokens" title="Total tokens: ${step.usage.totalTokens.toLocaleString()}&#10;Input: ${inputTokens.toLocaleString()} (${uncachedInputTokens.toLocaleString()} new + ${cachedTokens?.toLocaleString()} cached)&#10;Output: ${step.usage.outputTokens.toLocaleString()}">${step.usage.totalTokens.toLocaleString()} tok</span>
        <span class="output" title="Output tokens generated: ${step.usage.outputTokens.toLocaleString()}&#10;${cachedTokens > 0 ? `Cached input tokens (⚡): ${cachedTokens?.toLocaleString()} (not billed)` : "No cached tokens"}">(${step.usage.outputTokens.toLocaleString()}↑${cachedInfo})</span>
        <span class="reason">${step.finishReason}</span>
      </summary>
      <div class="step-content">
        ${assistantContentHtml}
      </div>
    </details>`;
    })
    .join("\n");
}

function renderTestSection(test: SingleTestResult, index: number) {
  const totalTokens = test.steps.reduce(
    (sum, step) => sum + step.usage.totalTokens,
    0,
  );
  const stepCount = test.steps.length;
  const verificationStatus = test.verification
    ? test.verification.passed
      ? "passed"
      : "failed"
    : "skipped";
  const verificationIcon = test.verification
    ? test.verification.passed
      ? "✓"
      : "✗"
    : "⊘";

  const stepsHtml = renderSteps(test.steps);
  const verificationHtml = renderVerificationResult(test.verification);

  const componentId = `component-${test.testName.replace(/[^a-zA-Z0-9]/g, "-")}`;

  // When validation fails, report 0 passed regardless of actual results
  const unitTestInfo = test.verification
    ? test.verification.validationFailed
      ? `0/${test.verification.numTests} unit tests (validation failed)`
      : `${test.verification.numPassed}/${test.verification.numTests} unit tests`
    : "";

  let resultWriteHtml = "";
  if (test.resultWriteContent) {
    const previewCode = getFirstLines(test.resultWriteContent, 5);
    const highlightedPreview = highlighter.codeToHtml(previewCode, {
      lang: "svelte",
      themes: { light: "github-light", dark: "github-dark" },
    });
    const highlightedFull = highlighter.codeToHtml(test.resultWriteContent, {
      lang: "svelte",
      themes: { light: "github-light", dark: "github-dark" },
    });

    resultWriteHtml = `<div class="output-section">
        <div class="token-summary">
          <h4>Total Tokens Used</h4>
          <div class="token-count">${totalTokens.toLocaleString()} tokens</div>
        </div>
        <h4>Generated Component</h4>
        <div class="component-preview">
          <div class="code code-preview" id="${componentId}-preview">${highlightedPreview}</div>
          <div class="code code-full" id="${componentId}-full" style="display: none;">${highlightedFull}</div>
          <button class="expand-button" onclick="toggleComponentCode('${componentId}')">
            <span class="expand-text">Show full code</span>
            <span class="collapse-text" style="display: none;">Show less</span>
          </button>
        </div>
      </div>`;
  }

  return `
  <details class="test-section ${verificationStatus}" open>
    <summary class="test-header">
      <span class="test-status ${verificationStatus}">${verificationIcon}</span>
      <span class="test-name">${escapeHtml(test.testName)}</span>
      <span class="test-meta">${stepCount} steps · ${totalTokens.toLocaleString()} tokens${unitTestInfo ? ` · ${unitTestInfo}` : ""}</span>
    </summary>
    <div class="test-content">
      <details class="prompt-section">
        <summary>Prompt</summary>
        <pre class="prompt-text">${escapeHtml(test.prompt)}</pre>
      </details>

      <div class="steps-section">
        <h4>Agent Steps</h4>
        ${stepsHtml}
      </div>

      ${resultWriteHtml}

      <div class="verification-section">
        <h4>Test Verification</h4>
        ${verificationHtml}
      </div>
    </div>
  </details>`;
}

function renderPricingSection(data: MultiTestResultData) {
  const { metadata } = data;
  const { pricing, totalCost, cacheSimulation, pricingKey } = metadata;

  if (!pricing && !totalCost) {
    return "";
  }

  let pricingInfoHtml = "";
  if (pricing) {
    const pricingKeyDisplay = pricingKey
      ? `<span class="pricing-key" title="Key matched in model-pricing.json">${escapeHtml(pricingKey)}</span>`
      : "";

    const cacheReadText =
      pricing.cacheReadCostPerMTok !== undefined
        ? `<span class="rate-separator">·</span><span class="rate-value">${formatMTokCost(pricing.cacheReadCostPerMTok)}/MTok cache read</span>`
        : "";

    const cacheWriteText =
      pricing.cacheCreationCostPerMTok !== undefined
        ? `<span class="rate-separator">·</span><span class="rate-value">${formatMTokCost(pricing.cacheCreationCostPerMTok)}/MTok cache write</span>`
        : "";

    pricingInfoHtml = `
      <div class="pricing-rates">
        <span class="rate-label">Model Pricing:</span>
        ${pricingKeyDisplay}
        <span class="rate-value">${formatMTokCost(pricing.inputCostPerMTok)}/MTok in</span>
        <span class="rate-separator">·</span>
        <span class="rate-value">${formatMTokCost(pricing.outputCostPerMTok)}/MTok out</span>
        ${cacheReadText}
        ${cacheWriteText}
      </div>
    `;
  }

  let nonCachedCostHtml = "";
  if (totalCost) {
    nonCachedCostHtml = `
      <div class="cost-section">
        <h5 class="cost-section-title">💵 Cost</h5>
        <div class="cost-breakdown">
          <div class="cost-row">
            <span class="cost-label">Input:</span>
            <span class="cost-tokens">${totalCost.inputTokens.toLocaleString()}</span>
            <span class="cost-value">${formatCost(totalCost.inputCost)}</span>
          </div>
          <div class="cost-row">
            <span class="cost-label">Output:</span>
            <span class="cost-tokens">${totalCost.outputTokens.toLocaleString()}</span>
            <span class="cost-value">${formatCost(totalCost.outputCost)}</span>
          </div>
          <div class="cost-row total">
            <span class="cost-label">Total:</span>
            <span class="cost-tokens"></span>
            <span class="cost-value">${formatCost(totalCost.totalCost)}</span>
          </div>
        </div>
      </div>
    `;
  }

  let cachedCostHtml = "";
  if (cacheSimulation && pricing?.cacheReadCostPerMTok !== undefined && pricing?.cacheCreationCostPerMTok !== undefined) {
    const hasCacheActivity = cacheSimulation.cacheHits > 0 || cacheSimulation.cacheWriteTokens > 0;
    
    if (hasCacheActivity && totalCost) {
      const savings = totalCost.totalCost - cacheSimulation.simulatedCostWithCache;
      const savingsPercent = totalCost.totalCost > 0 
        ? ((savings / totalCost.totalCost) * 100).toFixed(0)
        : "0";
      const savingsClass = savings > 0 ? "savings-positive" : "savings-negative";
      const savingsSign = savings >= 0 ? "+" : "";

      cachedCostHtml = `
        <div class="cost-section cached-section">
          <h5 class="cost-section-title">📊 Cost with prompt caching</h5>
          <div class="cost-breakdown">
            <div class="cost-row">
              <span class="cost-label">Cache reads:</span>
              <span class="cost-tokens">${cacheSimulation.cacheHits.toLocaleString()}</span>
              <span class="cost-value dim">${formatMTokCost(pricing.cacheReadCostPerMTok)}/MTok</span>
            </div>
            <div class="cost-row">
              <span class="cost-label">Cache writes:</span>
              <span class="cost-tokens">${cacheSimulation.cacheWriteTokens.toLocaleString()}</span>
              <span class="cost-value dim">${formatMTokCost(pricing.cacheCreationCostPerMTok)}/MTok</span>
            </div>
            <div class="cost-row">
              <span class="cost-label">Output:</span>
              <span class="cost-tokens">${cacheSimulation.outputTokens.toLocaleString()}</span>
              <span class="cost-value">${formatCost(cacheSimulation.simulatedOutputCost)}</span>
            </div>
            <div class="cost-row total">
              <span class="cost-label">Total:</span>
              <span class="cost-tokens"></span>
              <span class="cost-value-with-savings">
                ${formatCost(cacheSimulation.simulatedCostWithCache)}
                <span class="savings-badge ${savingsClass}">${savingsSign}${savingsPercent}%</span>
              </span>
            </div>
          </div>
        </div>
      `;
    }
  }

  return `
    <div class="pricing-section">
      <div class="pricing-header">
        <span class="pricing-icon">💰</span>
        <span class="pricing-title">Cost Summary</span>
      </div>
      ${pricingInfoHtml}
      <div class="cost-sections-container">
        ${nonCachedCostHtml}
        ${cachedCostHtml}
      </div>
    </div>
  `;
}

function getScoreClass(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

function getPricingStyles() {
  return `
    .pricing-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .pricing-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .pricing-icon {
      font-size: 16px;
    }

    .pricing-title {
      font-size: 14px;
    }

    .pricing-rates {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }

    .rate-label {
      font-weight: 500;
    }

    .pricing-key {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 11px;
    }

    .rate-value {
      font-family: 'JetBrains Mono', monospace;
    }

    .rate-separator {
      color: var(--border);
    }

    .cost-sections-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .cost-section {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 10px;
    }

    .cost-section.cached-section {
      border-color: var(--mcp-enabled);
      border-style: dashed;
    }

    .cost-section-title {
      font-size: 12px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--text);
    }

    .cost-breakdown {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cost-row {
      display: grid;
      grid-template-columns: 90px 1fr auto;
      gap: 6px;
      align-items: center;
      font-size: 12px;
    }

    .cost-row.total {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
      font-weight: 600;
    }

    .cost-label {
      color: var(--text-muted);
    }

    .cost-row.total .cost-label {
      color: var(--text);
    }

    .cost-tokens {
      font-family: 'JetBrains Mono', monospace;
      text-align: right;
      font-size: 11px;
    }

    .cost-value {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
      text-align: right;
      min-width: 60px;
    }

    .cost-value.dim {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: normal;
    }

    .cost-row.total .cost-value {
      color: var(--text);
      font-size: 13px;
    }

    .cost-value-with-savings {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
      text-align: right;
      min-width: 60px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      font-size: 13px;
    }

    .savings-badge {
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 600;
    }

    .savings-badge.savings-positive {
      background: var(--success);
      color: white;
    }

    .savings-badge.savings-negative {
      background: var(--error);
      color: white;
    }

    /* Validation styles */
    .validation-section {
      margin-bottom: 12px;
    }

    .validation-section h5 {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .validation-result {
      padding: 10px 12px;
      border-radius: 4px;
      border: 1px solid var(--border);
      margin-bottom: 8px;
    }

    .validation-result.passed {
      background: var(--passed-bg);
      border-color: var(--passed-border);
    }

    .validation-result.failed {
      background: var(--failed-bg);
      border-color: var(--failed-border);
    }

    .validation-result .validation-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .validation-result .validation-icon {
      font-size: 16px;
      font-weight: bold;
    }

    .validation-result.passed .validation-icon { color: var(--success); }
    .validation-result.failed .validation-icon { color: var(--error); }

    .validation-result .validation-text {
      font-weight: 600;
      font-size: 13px;
    }

    .validation-errors {
      margin-top: 8px;
      padding-left: 20px;
      list-style: disc;
    }

    .validation-error-item {
      color: var(--error);
      font-size: 12px;
      margin: 4px 0;
    }

    /* Unit test inline styles */
    .unit-tests-inline {
      font-size: 11px;
      color: var(--text-muted);
      margin-left: 4px;
    }

    /* Score badge styles */
    .score-badge {
      font-size: 18px;
      padding: 6px 16px;
      border-radius: 4px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }

    .score-badge.excellent {
      background: var(--success);
      color: white;
    }

    .score-badge.good {
      background: #2ea043;
      color: white;
    }

    .score-badge.fair {
      background: var(--warning);
      color: white;
    }

    .score-badge.poor {
      background: var(--error);
      color: white;
    }

    /* Summary bar improvements */
    .summary-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .summary-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `;
}

export function generateMultiTestHtml(data: MultiTestResultData) {
  const metadata = data.metadata;
  const totalTests = data.tests.length;
  const passedTests = data.tests.filter((t) => t.verification?.passed).length;
  const failedTests = data.tests.filter(
    (t) => t.verification && !t.verification.passed,
  ).length;
  const skippedTests = data.tests.filter((t) => !t.verification).length;

  const unitTestTotals = metadata.unitTestTotals;

  const totalTokens = data.tests.reduce(
    (sum, test) =>
      sum + test.steps.reduce((s, step) => s + step.usage.totalTokens, 0),
    0,
  );

  const mcpBadge = metadata.mcpEnabled
    ? metadata.mcpTransportType === "StdIO"
      ? `<span class="mcp-badge enabled">MCP ✓ (StdIO: ${escapeHtml(metadata.mcpServerUrl || "")})</span>`
      : `<span class="mcp-badge enabled">MCP ✓ (${escapeHtml(metadata.mcpServerUrl || "")})</span>`
    : `<span class="mcp-badge disabled">MCP ✗</span>`;

  const mcpNotice = !metadata.mcpEnabled
    ? `
  <div class="mcp-notice">
    <span class="notice-icon">ℹ️</span>
    <span class="notice-text">MCP integration was not used in this benchmark. The agent ran with built-in tools only.</span>
  </div>`
    : "";

  const costDisplay = metadata.totalCost
    ? `<span class="cost-badge">${formatCost(metadata.totalCost.totalCost)}</span>`
    : "";

  const scoreClass = getScoreClass(unitTestTotals.score);

  const testsHtml = data.tests
    .map((test, index) => renderTestSection(test, index))
    .join("\n");

  const pricingHtml = renderPricingSection(data);

  const styles =
    getReportStyles() +
    getPricingStyles() +
    `
    .cost-badge {
      background: var(--success);
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      font-family: 'JetBrains Mono', monospace;
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SvelteBench 2.0 - Multi-Test Report</title>
  <style>${styles}</style>
</head>
<body>
  <header>
    <div class="header-top">
      <div>
        <h1>SvelteBench 2.0 ${mcpBadge} ${costDisplay}</h1>
        <div class="meta">${escapeHtml(metadata.model)} · ${totalTests} tests · ${totalTokens.toLocaleString()} tokens · ${formatTimestamp(metadata.timestamp)}</div>
      </div>
      <button class="theme-toggle" onclick="toggleTheme()">◐</button>
    </div>
    <div class="summary-bar">
      <span class="score-badge ${scoreClass}" title="Score: ${unitTestTotals.passed} passed / ${unitTestTotals.total} total unit tests">${unitTestTotals.score}%</span>
      <div class="summary-group">
        <div class="summary-item passed">✓ ${passedTests} passed</div>
        <div class="summary-item failed">✗ ${failedTests} failed</div>
        ${skippedTests > 0 ? `<div class="summary-item skipped">⊘ ${skippedTests} skipped</div>` : ""}
        <span class="unit-tests-inline">(${unitTestTotals.passed}/${unitTestTotals.total} unit tests)</span>
      </div>
    </div>
  </header>

  ${mcpNotice}

  ${pricingHtml}

  ${testsHtml}

  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.dataset.theme || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      html.dataset.theme = next;
      localStorage.setItem('theme', next);
    }

    function toggleComponentCode(id) {
      const preview = document.getElementById(id + '-preview');
      const full = document.getElementById(id + '-full');
      const button = event.target.closest('button');
      const expandText = button.querySelector('.expand-text');
      const collapseText = button.querySelector('.collapse-text');
      
      if (preview.style.display === 'none') {
        preview.style.display = 'block';
        full.style.display = 'none';
        expandText.style.display = 'inline';
        collapseText.style.display = 'none';
      } else {
        preview.style.display = 'none';
        full.style.display = 'block';
        expandText.style.display = 'none';
        collapseText.style.display = 'inline';
      }
    }

    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
  </script>
</body>
</html>`;
}
