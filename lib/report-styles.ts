/**
 * CSS styles for the HTML report
 */
export function getReportStyles(): string {
  return `
    :root {
      --bg: #f8f8f8;
      --surface: #ffffff;
      --text: #24292e;
      --text-muted: #6a737d;
      --border: #e1e4e8;
      --success: #238636;
      --error: #cf222e;
      --warning: #9a6700;
      --tool: #8250df;
      --mcp-enabled: #0969da;
      --mcp-disabled: #6a737d;
      --notice-bg: #ddf4ff;
      --notice-border: #54aeff;
      --passed-bg: #dafbe1;
      --passed-border: #238636;
      --failed-bg: #ffebe9;
      --failed-border: #cf222e;
      --skipped-bg: #fff8c5;
      --skipped-border: #9a6700;
    }

    [data-theme="dark"] {
      --bg: #0d1117;
      --surface: #161b22;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --border: #30363d;
      --success: #3fb950;
      --error: #f85149;
      --warning: #d29922;
      --tool: #a371f7;
      --mcp-enabled: #58a6ff;
      --mcp-disabled: #8b949e;
      --notice-bg: #1c2d41;
      --notice-border: #388bfd;
      --passed-bg: #1a3d24;
      --passed-border: #3fb950;
      --failed-bg: #3d1a1a;
      --failed-border: #f85149;
      --skipped-bg: #3d3514;
      --skipped-border: #d29922;
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
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .summary-bar {
      display: flex;
      gap: 16px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      margin-top: 8px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }

    .summary-item.passed { color: var(--success); }
    .summary-item.failed { color: var(--error); }
    .summary-item.skipped { color: var(--warning); }

    .mcp-badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      white-space: nowrap;
    }

    .mcp-badge.enabled {
      background: var(--mcp-enabled);
      color: white;
    }

    .mcp-badge.disabled {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }

    .mcp-notice {
      background: var(--notice-bg);
      border: 1px solid var(--notice-border);
      border-radius: 4px;
      padding: 10px 12px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .notice-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .notice-text {
      color: var(--text);
      line-height: 1.5;
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

    /* Test Section Styles */
    .test-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .test-section.passed {
      border-left: 3px solid var(--success);
    }

    .test-section.failed {
      border-left: 3px solid var(--error);
    }

    .test-section.skipped {
      border-left: 3px solid var(--warning);
    }

    .test-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      cursor: pointer;
      user-select: none;
      list-style: none;
    }

    .test-header::-webkit-details-marker {
      display: none;
    }

    .test-header:hover {
      background: var(--bg);
    }

    .test-status {
      font-size: 16px;
      font-weight: bold;
    }

    .test-status.passed { color: var(--success); }
    .test-status.failed { color: var(--error); }
    .test-status.skipped { color: var(--warning); }

    .test-name {
      font-weight: 600;
      font-size: 14px;
    }

    .test-meta {
      margin-left: auto;
      color: var(--text-muted);
      font-size: 12px;
    }

    .test-content {
      padding: 12px;
      border-top: 1px solid var(--border);
    }

    .test-content h4 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-muted);
    }

    .prompt-section {
      margin-bottom: 16px;
    }

    .prompt-section summary {
      cursor: pointer;
      padding: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      font-weight: 600;
    }

    .prompt-text {
      padding: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 3px 3px;
      white-space: pre-wrap;
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
    }

    .steps-section {
      margin-bottom: 16px;
    }

    .output-section {
      margin-bottom: 16px;
    }

    .token-summary {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .token-summary h4 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .token-count {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
    }

    .component-preview {
      position: relative;
    }

    .expand-button {
      display: block;
      width: 100%;
      padding: 8px;
      margin-top: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s;
    }

    .expand-button:hover {
      background: var(--border);
    }

    .verification-section {
      margin-top: 16px;
    }

    /* Step Styles */
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
      cursor: help;
      border-bottom: 1px dotted var(--text-muted);
    }

    .output {
      color: var(--text);
      cursor: help;
      border-bottom: 1px dotted var(--text-muted);
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

    .code {
      padding: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      overflow-x: auto;
      font-size: 12px;
      white-space: pre-wrap;
    }

    .code-preview,
    .code-full {
      max-height: none;
      overflow-y: visible;
    }

    /* Shiki dual-theme support */
    .code-preview .shiki,
    .code-full .shiki {
      background-color: transparent !important;
      margin: 0;
      padding: 0;
      tab-size: 2;
      -moz-tab-size: 2;
    }

    .code-preview pre,
    .code-full pre {
      background-color: transparent !important;
      margin: 0;
      padding: 0;
      tab-size: 2;
      -moz-tab-size: 2;
    }

    .shiki,
    .shiki span {
      color: var(--shiki-light) !important;
      background-color: var(--shiki-light-bg) !important;
      tab-size: 2;
      -moz-tab-size: 2;
    }

    [data-theme="dark"] .shiki,
    [data-theme="dark"] .shiki span {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg) !important;
      tab-size: 2;
      -moz-tab-size: 2;
    }

    /* Verification Styles */
    .verification-result {
      padding: 12px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .verification-result.passed {
      background: var(--passed-bg);
      border-color: var(--passed-border);
    }

    .verification-result.failed {
      background: var(--failed-bg);
      border-color: var(--failed-border);
    }

    .verification-result.skipped {
      background: var(--skipped-bg);
      border-color: var(--skipped-border);
    }

    .verification-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .verification-icon {
      font-size: 18px;
      font-weight: bold;
    }

    .verification-result.passed .verification-icon { color: var(--success); }
    .verification-result.failed .verification-icon { color: var(--error); }
    .verification-result.skipped .verification-icon { color: var(--warning); }

    .verification-text {
      font-weight: 600;
    }

    .verification-stats {
      margin-left: auto;
      color: var(--text-muted);
      font-size: 12px;
    }

    .verification-error {
      margin-top: 8px;
      padding: 8px;
      background: var(--bg);
      border-radius: 3px;
      font-size: 12px;
      color: var(--error);
    }

    .failed-tests-details {
      margin-top: 12px;
    }

    .failed-tests-details summary {
      cursor: pointer;
      font-weight: 600;
      padding: 4px 0;
    }

    .failed-tests-list {
      list-style: none;
      margin-top: 8px;
    }

    .failed-test {
      margin-bottom: 12px;
      padding: 8px;
      background: var(--bg);
      border-radius: 3px;
    }

    .failed-test-name {
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--error);
    }

    .failed-test-error {
      font-size: 11px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
      background: var(--surface);
      padding: 8px;
      border-radius: 3px;
    }

    @media (max-width: 768px) {
      body {
        padding: 8px;
      }
    }
  `;
}
