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

# Generate index.html with all results
bun run generate-index

# Build all reports (generate-report + generate-index)
bun run build

# Run unit tests for lib modules
bun test

# Run specific test file
bun test lib/utils.test.ts

# Run TypeScript type checking
bun tsc --noEmit

# Format code with Prettier
bun run prettier

# Lint code
bun run lint

# Lint and fix code
bun run lint:fix

# Link to Vercel project for AI Gateway
bun run vercel:link

# Pull environment variables from Vercel
bun run vercel:env:pull
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
│   ├── test-discovery.ts       # Test suite discovery
│   ├── output-test-runner.ts   # Vitest runner for component verification
│   ├── output-test-runner.test.ts # Unit tests for output runner
│   ├── validator-runner.ts     # Optional validator runner
│   ├── validator-runner.test.ts # Unit tests for validator runner
│   ├── verify-references.ts    # Reference implementation verification
│   ├── report.ts               # Report generation orchestration
│   ├── report.test.ts          # Unit tests for report module
│   ├── report-template.ts      # HTML report template generation
│   ├── report-styles.ts        # CSS styles for HTML reports
│   ├── token-cache.ts          # Token cache simulation for cost estimation
│   ├── utils.ts                # Utility functions (sanitization, cost calculation, etc.)
│   ├── utils.test.ts           # Unit tests for utility functions
│   └── tools/
│       ├── index.ts            # Tool exports
│       ├── result-write.ts     # ResultWrite tool for final output
│       ├── result-write.test.ts # Unit tests for ResultWrite tool
│       ├── test-component.ts   # TestComponent tool for iterative testing
│       └── test-component.test.ts # Unit tests for TestComponent tool
├── tests/                      # Benchmark test suites
│   └── {test-name}/
│       ├── Reference.svelte    # Reference implementation (required)
│       ├── test.ts             # Vitest test file (required)
│       ├── prompt.md           # Agent prompt (required)
│       └── validator.ts        # Optional custom validator
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
- `lookupPricingFromMap()`: Find pricing for a specific model
- `calculateCost()`: Calculate total cost from token usage
- `formatCost()` / `formatMTokCost()`: Format costs for display
- `getModelPricingDisplay()`: Convert per-token costs to per-MTok for display

### Token Cache Simulation

The `lib/token-cache.ts` module simulates prompt caching behavior:

**TokenCache Class:**

- Models growing prefix cache across multiple API calls
- Tracks cache hits, cache writes, and output tokens
- Calculates simulated costs using cache read/write rates
- Default rates: 10% for reads, 125% for writes (if not specified in pricing)

**Cache Behavior Model:**

1. Each test runs in its own context (cache resets between tests)
2. Step 1's input is written to cache (pays cache creation rate)
3. Each subsequent step:
   - Previous step's full input is cached (pays cache read rate)
   - New tokens extend the cache (pays cache creation rate)
4. The cache prefix grows with each step

**simulateCacheSavings()** (in `lib/utils.ts`):

- Estimates cost savings with prompt caching enabled
- Returns `simulatedCostWithCache`, `cacheHits`, and `cacheWriteTokens`
- Results displayed in HTML report as "Cache Simulation" section
- Shows potential savings compared to actual cost without caching

### Test Discovery

The `lib/test-discovery.ts` module handles test suite discovery:

**Key Functions:**

- `discoverTests()`: Scans `tests/` directory for test suites
- Returns array of `TestDefinition` objects
- Each test suite must have all three files: Reference.svelte, test.ts, and prompt.md
- Skips incomplete test suites with a warning

**Test Definition Structure:**
```typescript
interface TestDefinition {
  name: string;           // Directory name from tests/{name}/
  directory: string;      // Full path to test directory
  referenceFile: string;  // Path to Reference.svelte
  componentFile: string;  // Path to Component.svelte (generated)
  testFile: string;       // Path to test.ts
  promptFile: string;     // Path to prompt.md
  prompt: string;         // Contents of prompt.md file
  testContent: string;    // Contents of test.ts file
}
```

### Validator Runner

The `lib/validator-runner.ts` module provides optional validation for test outputs:

**Key Functions:**

- `hasValidator()`: Check if a test has an optional `validator.ts` file
- `getValidatorPath()`: Get the path to the validator file if it exists
- Validators can perform custom validation logic beyond standard test suites

**Validator Interface:**
```typescript
interface ValidatorModule {
  validate: (code: string) => ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

### Utility Functions

The `lib/utils.ts` module provides core utilities:

- `sanitizeModelName()`: Convert model IDs to filesystem-safe names
- `getTimestampedFilename()`: Generate timestamped filenames with optional model suffix
- `isHttpUrl()`: Check if string is HTTP/HTTPS URL
- `extractResultWriteContent()`: Extract component code from agent steps
- `calculateTotalCost()`: Aggregate token usage and costs across all tests
- `buildAgentPrompt()`: Build user message array from test definition
- `simulateCacheSavings()`: Simulate cache savings using growing prefix model

### Reference Verification

The `lib/verify-references.ts` module verifies reference implementations:

**Key Functions:**

- `loadTestDefinitions()`: Discover test suites in `tests/` directory
- `copyReferenceToComponent()`: Copy Reference.svelte to Component.svelte temporarily
- `cleanupComponent()`: Remove temporary Component.svelte file
- `runTest()`: Execute tests and collect detailed results
- `printSummary()`: Display verification results summary
- `verifyAllReferences()`: Main function that orchestrates entire verification workflow

**Workflow:**

1. Discover all test suites with Reference.svelte
2. For each test:
   - Copy Reference.svelte → Component.svelte
   - Run vitest against the test
   - Collect pass/fail results
   - Cleanup Component.svelte
3. Print summary of all results
4. Return exit code (0 for success, 1 for failures)

Used by `verify-references.ts` script accessible via `bun run verify-tests`.

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
6. Cache simulation estimates potential savings
7. Results written to `results/result-YYYY-MM-DD-HH-MM-SS.json`
8. HTML report generated at `results/result-YYYY-MM-DD-HH-MM-SS.html`
9. Report automatically opens in default browser

### Output Files

All results are saved in the `results/` directory with timestamped filenames:

- **JSON files**: `result-2024-12-07-14-30-45.json` - Complete execution trace
- **HTML files**: `result-2024-12-07-14-30-45.html` - Interactive visualization
- **Index file**: `index.html` - Dashboard showing all benchmark results with score, pass/fail rates, and costs

**Report Generation:**

- `generate-report.ts`: Converts individual JSON result files to HTML reports
- `generate-index.ts`: Creates an index.html dashboard from all result JSON files
- `bun run build`: Runs both scripts to generate all reports

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
      "cacheReadCostPerMTok": 0.3,
      "cacheCreationCostPerMTok": 3.75
    },
    "totalCost": {
      "inputCost": 0.003,
      "outputCost": 0.015,
      "cacheReadCost": 0.0003,
      "totalCost": 0.0183,
      "inputTokens": 1000,
      "outputTokens": 1000,
      "cachedInputTokens": 1000
    },
    "cacheSimulation": {
      "simulatedCostWithCache": 0.015,
      "cacheHits": 2000,
      "cacheWriteTokens": 1500
    }
  }
}
```

## Unit Tests

Unit tests for library modules are in `lib/*.test.ts`:

- `lib/pricing.test.ts` - Pricing extraction, calculation, formatting
- `lib/output-test-runner.test.ts` - Output directory management and test execution
- `lib/validator-runner.test.ts` - Validator test runner
- `lib/report.test.ts` - Report generation
- `lib/tools/result-write.test.ts` - ResultWrite tool behavior
- `lib/tools/test-component.test.ts` - TestComponent tool behavior
- `lib/utils.test.ts` - Utility functions, cost calculation, cache simulation

Run all unit tests with: `bun test`
Run specific test file: `bun test lib/utils.test.ts`

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
- Cache simulation shows estimated savings if prompt caching were enabled
- Exit code is 0 if all tests pass, 1 if any tests fail
- Pricing is fetched from Vercel AI Gateway model metadata at runtime

## Important notes

Always run `bun tsc --noEmit` and `bun test` before completing work to make sure the TypeScript types and tests pass.
