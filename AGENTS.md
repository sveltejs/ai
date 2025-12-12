## Project Overview

AI SDK benchmarking tool built with Vercel AI SDK and Bun runtime. Tests AI agents with MCP (Model Context Protocol) server integration using the Vercel AI Gateway. Automatically discovers and runs all tests in the `tests/` directory and verifies LLM-generated Svelte components against test suites.

## Development Commands

```bash
# Install dependencies (runs patch-package automatically)
bun install

# Run the main benchmark (interactive CLI)
bun run start

# Verify reference implementations against test suites
bun run verify-tests

# Generate HTML reports from all result JSON files
bun run generate-report.ts

# Generate HTML report from specific result file
bun run generate-report.ts results/result-2024-12-07-14-30-45.json

# Run unit tests for lib modules
bun run test:self

# Run TypeScript type checking
bun tsc --noEmit

# Format code with Prettier
bun run prettier
```

## Environment Variables

### Vercel AI Gateway

The benchmark uses the Vercel AI Gateway for model access. Configuration:

1. Link to a Vercel project with AI Gateway enabled: `bun run vercel:link`
2. Pull environment variables: `bun run vercel:env:pull`

Required environment variable:

- `VERCEL_OIDC_TOKEN`: OIDC token for Vercel AI Gateway authentication

### MCP Server Configuration

MCP integration is configured via the interactive CLI at runtime. Options:

- **No MCP Integration**: Agent runs with built-in tools only
- **MCP over HTTP**: Uses HTTP transport (default: `https://mcp.svelte.dev/mcp`)
- **MCP over StdIO**: Uses local command (default: `npx -y @sveltejs/mcp`)

## Architecture

### Directory Structure

```
├── index.ts                    # Main entry point with interactive CLI
├── lib/
│   ├── pricing.ts              # Cost calculation from gateway pricing
│   ├── pricing.test.ts         # Unit tests for pricing module
│   ├── test-discovery.ts       # Test suite discovery and prompt building
│   ├── test-discovery.test.ts  # Unit tests for test discovery
│   ├── output-test-runner.ts   # Vitest runner for component verification
│   ├── output-test-runner.test.ts # Unit tests for output runner
│   ├── verify-references.ts    # Reference implementation verification
│   ├── report.ts               # Report generation orchestration
│   ├── report-template.ts      # HTML report template generation
│   ├── report-styles.ts        # CSS styles for HTML reports
│   └── tools/
│       ├── index.ts            # Tool exports
│       ├── result-write.ts     # ResultWrite tool for final output
│       ├── result-write.test.ts # Unit tests for ResultWrite tool
│       ├── test-component.ts   # TestComponent tool for iterative testing
│       └── test-component.test.ts # Unit tests for TestComponent tool
├── tests/                      # Benchmark test suites
│   └── {test-name}/
│       ├── Reference.svelte    # Reference implementation
│       ├── test.ts             # Vitest test file
│       └── prompt.md           # Agent prompt
├── results/                    # Benchmark results (JSON + HTML)
├── outputs/                    # Temporary directory for test verification
└── patches/                    # Patches for dependencies
```

### Test Suite Structure

Benchmark test suites in `tests/` directory:

```
tests/
  {test-name}/
    Reference.svelte  - Reference implementation of the component
    test.ts          - Vitest test file (imports "./Component.svelte")
    prompt.md        - Prompt for AI agents to implement the component
```

**Benchmark Workflow:**

1. `index.ts` presents interactive CLI for model/MCP selection
2. Discovers all test suites in `tests/`
3. For each selected model and test:
   - Loads `prompt.md` and builds agent prompt
   - Agent generates component code using available tools
   - Agent calls `ResultWrite` tool with the component code
   - Component is written to `outputs/{test-name}/Component.svelte`
   - Test file is copied to `outputs/{test-name}/test.ts`
   - Vitest runs tests against the generated component
   - Results are collected (pass/fail, error messages)
   - Output directory is cleaned up
4. All results are saved to timestamped JSON file
5. HTML report is generated with expandable sections for each test

### Agent Tools

**ResultWrite** (`lib/tools/result-write.ts`):

- Called when agent completes component implementation
- Signals the agent to stop (via `stopWhen` configuration)
- Accepts `content` parameter with Svelte component code

**TestComponent** (`lib/tools/test-component.ts`):

- Optional tool for iterative development
- Runs component against test suite before final submission
- Returns pass/fail status and detailed error messages
- Enabled/disabled via interactive CLI

### Interactive CLI

The benchmark uses `@clack/prompts` for an interactive CLI that prompts for:

1. **Model Selection**: Multi-select from Vercel AI Gateway available models
2. **MCP Integration**: Choose HTTP, StdIO, or no MCP
3. **TestComponent Tool**: Enable/disable iterative testing tool
4. **Pricing Confirmation**: Review and confirm cost calculation settings

### Pricing System

The pricing module (`lib/pricing.ts`) handles cost calculation:

- Extracts pricing from Vercel AI Gateway model metadata
- Calculates costs based on input/output/cached tokens
- Supports cache read billing at reduced rates
- Displays costs in reports with per-million-token rates

Key functions:

- `extractPricingFromGatewayModel()`: Parse gateway model pricing
- `buildPricingMap()`: Build lookup map from gateway models
- `calculateCost()`: Calculate total cost from token usage
- `formatCost()` / `formatMTokCost()`: Format costs for display

### Key Technologies

- **Vercel AI SDK v5**: Agent framework with tool calling
- **Vercel AI Gateway**: Unified access to multiple AI providers
- **@ai-sdk/mcp**: MCP client integration (with custom patch)
- **@clack/prompts**: Interactive CLI prompts
- **Bun Runtime**: JavaScript runtime (not Node.js)
- **Vitest**: Test framework for component testing
- **@testing-library/svelte**: Testing utilities for Svelte components

### MCP Integration

The project uses `@ai-sdk/mcp` with a custom patch applied via `patch-package`:

- Patch location: `patches/@ai-sdk+mcp+0.0.11.patch`
- Fixes: Handles missing event types in HTTP SSE responses
- Supports both HTTP and StdIO transports
- Configuration via interactive CLI at runtime

### Data Flow

1. Interactive CLI collects configuration (models, MCP, tools)
2. Gateway provides available models and pricing
3. Test discovery scans `tests/` directory
4. For each model and test:
   a. Agent receives prompt with access to tools (built-in + optional MCP)
   b. Agent iterates through steps, calling tools as needed
   c. Agent stops when `ResultWrite` tool is called
   d. Component is written to `outputs/{test-name}/Component.svelte`
   e. Vitest runs test file against the generated component
   f. Test results are collected (pass/fail, error details)
   g. Output directory is cleaned up
5. Results aggregated with pricing calculations
6. Results written to `results/result-YYYY-MM-DD-HH-MM-SS.json`
7. HTML report generated at `results/result-YYYY-MM-DD-HH-MM-SS.html`
8. Report automatically opens in default browser

### Output Files

All results are saved in the `results/` directory with timestamped filenames:

- **JSON files**: `result-2024-12-07-14-30-45.json` - Complete execution trace
- **HTML files**: `result-2024-12-07-14-30-45.html` - Interactive visualization

**Multi-Test Result JSON Structure:**

```json
{
  "tests": [
    {
      "testName": "counter",
      "prompt": "# Counter Component Task...",
      "steps": [...],
      "resultWriteContent": "<script>...</script>...",
      "verification": {
        "testName": "counter",
        "passed": true,
        "numTests": 4,
        "numPassed": 4,
        "numFailed": 0,
        "duration": 150,
        "failedTests": []
      }
    }
  ],
  "metadata": {
    "mcpEnabled": true,
    "mcpServerUrl": "https://mcp.svelte.dev/mcp",
    "mcpTransportType": "HTTP",
    "timestamp": "2024-12-07T14:30:45.123Z",
    "model": "anthropic/claude-sonnet-4",
    "pricingKey": "anthropic/claude-sonnet-4",
    "pricing": {
      "inputCostPerMTok": 3,
      "outputCostPerMTok": 15,
      "cacheReadCostPerMTok": 0.3
    },
    "totalCost": {
      "inputCost": 0.003,
      "outputCost": 0.015,
      "cacheReadCost": 0.0003,
      "totalCost": 0.0183,
      "inputTokens": 1000,
      "outputTokens": 1000,
      "cachedInputTokens": 1000
    }
  }
}
```

## Unit Tests

Unit tests for library modules are in `lib/*.test.ts`:

- `lib/pricing.test.ts` - Pricing extraction, calculation, formatting
- `lib/test-discovery.test.ts` - Test suite discovery and prompt building
- `lib/output-test-runner.test.ts` - Output directory management
- `lib/tools/result-write.test.ts` - ResultWrite tool behavior
- `lib/tools/test-component.test.ts` - TestComponent tool behavior

Run unit tests with: `bun run test:self`

## TypeScript Configuration

- **Runtime**: Bun (not Node.js)
- **Module System**: ESNext with `module: "Preserve"` and `moduleResolution: "bundler"`
- **Strict Mode**: Enabled with additional checks:
  - `noUncheckedIndexedAccess: true` - array/index access always includes undefined
  - `noImplicitOverride: true` - override keyword required
  - `noFallthroughCasesInSwitch: true`
- **Import Extensions**: `.ts` extensions allowed in imports
- **No Emit**: TypeScript compilation not required for Bun runtime

## Important Notes

- The MCP client import uses a direct path to the patched module: `./node_modules/@ai-sdk/mcp/dist/index.mjs`
- Agent stops execution when the `ResultWrite` tool is called (configured via `stopWhen` option)
- Agent also stops after 10 steps maximum (configured via `stepCountIs(10)`)
- The `outputs/` directory is used temporarily for test verification and is cleaned up after each test
- HTML reports include expandable sections for each test with full step details
- Test verification results show pass/fail status and failed test details
- Token usage includes cached token counts when available
- All result files are saved with timestamps to preserve historical benchmarks
- MCP integration can be configured via interactive CLI without code changes
- MCP status is clearly indicated in both the JSON metadata and HTML report with a visual badge
- Exit code is 0 if all tests pass, 1 if any tests fail
- Pricing is fetched from Vercel AI Gateway model metadata at runtime
