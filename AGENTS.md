## Project Overview

AI SDK benchmarking tool built with Vercel AI SDK and Bun runtime. Tests AI agents with MCP (Model Context Protocol) server integration, specifically using the Svelte MCP server for agent benchmarks. Automatically discovers and runs all tests in the `tests/` directory and verifies generated components against test suites.

## Development Commands

```bash
# Install dependencies (runs patch-package automatically)
bun install

# Run main benchmark (discovers and runs all tests)
bun run index.ts

# Verify reference implementations against test suites
bun run verify-tests

# Generate HTML report from most recent result
bun run generate-report.ts

# Generate HTML report from specific result file
bun run generate-report.ts results/result-2024-12-07-14-30-45.json

# Run TypeScript type checking
bun tsc --noEmit

# Secrets management
bun run secrets                       # Show token status
bun run secrets set VERCEL_OIDC_TOKEN <value>  # Store Vercel token
bun run secrets get VERCEL_OIDC_TOKEN           # Get Vercel token
```

## Environment Variables

### MODEL Configuration

The `MODEL` environment variable determines which AI provider to use:

**Anthropic Direct API:**

```bash
MODEL=anthropic/claude-haiku-4-5
MODEL=anthropic/claude-sonnet-4
```

**OpenAI Direct API:**

```bash
MODEL=openai/gpt-5
MODEL=openai/gpt-5-mini
MODEL=openai/gpt-4o
```

**OpenRouter (300+ models):**

```bash
MODEL=openrouter/anthropic/claude-sonnet-4
MODEL=openrouter/google/gemini-pro
MODEL=openrouter/meta-llama/llama-3.1-405b-instruct
```

**LM Studio (Local models via OpenAI-compatible API):**

```bash
MODEL=lmstudio/model-name
```

LM Studio runs a local OpenAI-compatible API server on `http://localhost:1234/v1`. Make sure LM Studio is running with a model loaded before using this provider.

### MCP Server Configuration

The `MCP_SERVER_URL` environment variable controls MCP (Model Context Protocol) integration. The tool automatically detects whether to use HTTP or StdIO transport based on the value format.

**HTTP MCP Servers (Remote):**

```bash
# Enable MCP with Svelte server (default for this benchmark)
MCP_SERVER_URL=https://mcp.svelte.dev/mcp

# Use a different HTTP MCP server
MCP_SERVER_URL=https://your-mcp-server.com/mcp
```

**StdIO MCP Servers (Local):**

For local MCP servers, simply provide the command string (any non-HTTP value):

```bash
# Use the default Svelte MCP server via npx
MCP_SERVER_URL=npx -y @sveltejs/mcp

# Use a custom local MCP server
MCP_SERVER_URL=node path/to/your/mcp-server.js

# Use with Bun runtime
MCP_SERVER_URL=bun run src/mcp-server.ts --verbose
```

**Disable MCP:**

```bash
# Disable MCP integration (run without external tools)
MCP_SERVER_URL=
```

**Behavior:**

- If `MCP_SERVER_URL` starts with `http://` or `https://`: Uses HTTP transport with that URL
- If `MCP_SERVER_URL` is set but not an HTTP URL: Uses StdIO transport, treating the value as a command string
- If `MCP_SERVER_URL` is empty or not set: Agent runs without MCP tools (only built-in tools)
- MCP transport type (HTTP or StdIO) and configuration are documented in the result JSON and HTML report

### Required API Keys

- `VERCEL_OIDC_TOKEN`: Required for Vercel AI Gateway (stored in bun.secrets)
- Other API keys (Anthropic, OpenAI, OpenRouter) are configured in Vercel dashboard when using AI Gateway

### Secrets Management

The tool uses Bun's secure credential storage for the Vercel OIDC token:

```bash
# Store Vercel OIDC token
bun run secrets set VERCEL_OIDC_TOKEN your_token_here

# Check if token is stored
bun run secrets

# Get the stored token
bun run secrets get VERCEL_OIDC_TOKEN
```

**Security Benefits:**
- Encrypted storage using OS credential manager (Keychain, libsecret, Windows Credential Manager)
- No plaintext tokens in files
- User-level access control

### Provider Routing

The benchmark tool automatically routes to the correct provider based on the `MODEL` prefix:

- `anthropic/*` → Direct Anthropic API
- `openai/*` → Direct OpenAI API
- `openrouter/*` → OpenRouter unified API
- `lmstudio/*` → LM Studio local server (OpenAI-compatible)

This allows switching models and providers without any code changes.

## Architecture

### Test Suite Structure

Test suites are organized in the `tests/` directory with the following structure:

```
tests/
  {test-name}/
    Reference.svelte  - Reference implementation of the component
    test.ts          - Vitest test file (imports "./Component.svelte")
    prompt.md        - Prompt for AI agents to implement the component
```

**Benchmark Workflow:**

1. `index.ts` discovers all test suites in `tests/`
2. For each test:
   - Loads `prompt.md` and builds agent prompt
   - Agent generates component code based on the prompt
   - Agent calls `ResultWrite` tool with the component code
   - Component is written to `outputs/{test-name}/Component.svelte`
   - Test file is copied to `outputs/{test-name}/test.ts`
   - Vitest runs tests against the generated component
   - Results are collected (pass/fail, error messages)
   - Output directory is cleaned up
3. All results are saved to a timestamped JSON file
4. HTML report is generated with expandable sections for each test

**Reference Verification:**

- Run `bun run verify-tests` to validate reference implementations
- Each test file imports `Component.svelte` (not Reference.svelte directly)
- Verification system temporarily copies Reference.svelte → Component.svelte
- Tests use `@testing-library/svelte` for component testing
- Tests use `data-testid` attributes for element selection

### Key Technologies

- **Vercel AI SDK v5**: Agent framework with tool calling
- **@ai-sdk/anthropic**: Anthropic provider for direct API access
- **@ai-sdk/openai**: OpenAI provider for direct API access
- **@ai-sdk/openai-compatible**: OpenAI-compatible provider for LM Studio and other local servers
- **@openrouter/ai-sdk-provider**: OpenRouter provider for unified access to 300+ models
- **@ai-sdk/mcp**: MCP client integration (with custom patch)
- **Bun Runtime**: JavaScript runtime (not Node.js)
- **Vitest**: Test framework for component testing
- **@testing-library/svelte**: Testing utilities for Svelte components

### MCP Integration

The project uses `@ai-sdk/mcp` with a custom patch applied via `patch-package`:

- Patch location: `patches/@ai-sdk+mcp+0.0.11.patch`
- Fixes: Handles missing event types in HTTP SSE responses by treating undefined events as "message" events
- MCP server: Configurable via `MCP_SERVER_URL` environment variable
- Default server: Svelte documentation server (`https://mcp.svelte.dev/mcp`)
- Can be disabled by leaving `MCP_SERVER_URL` empty

### Data Flow

1. Test discovery scans `tests/` directory for valid test suites
2. For each test:
   a. Agent receives prompt with access to tools (built-in + optional MCP tools)
   b. Agent iterates through steps, calling tools as needed
   c. Agent stops when `ResultWrite` tool is called with component code
   d. Component is written to `outputs/{test-name}/Component.svelte`
   e. Vitest runs test file against the generated component
   f. Test results are collected (pass/fail, error details)
   g. Output directory is cleaned up
3. All results aggregated into multi-test result object
4. Results written to `results/result-YYYY-MM-DD-HH-MM-SS.json` with metadata
5. HTML report generated at `results/result-YYYY-MM-DD-HH-MM-SS.html`
6. Report automatically opens in default browser

### Output Files

All results are saved in the `results/` directory with timestamped filenames:

- **JSON files**: `result-2024-12-07-14-30-45.json` - Complete execution trace with all test results
- **HTML files**: `result-2024-12-07-14-30-45.html` - Interactive visualization with expandable test sections

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
    },
    ...
  ],
  "metadata": {
    "mcpEnabled": true,
    "mcpServerUrl": "https://mcp.svelte.dev/mcp",
    "timestamp": "2024-12-07T14:30:45.123Z",
    "model": "anthropic/claude-sonnet-4"
  }
}
```

This naming convention allows you to:

- Run multiple benchmarks without overwriting previous results
- Easily identify when each benchmark was run
- Compare results across different runs
- Track whether MCP was enabled for each run
- See per-test verification status

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
- The `outputs/` directory is used temporarily for test verification and is cleaned up after each test
- HTML reports include expandable sections for each test with full step details
- Test verification results show pass/fail status and failed test details
- Token usage includes cached token counts when available
- All result files are saved with timestamps to preserve historical benchmarks
- MCP integration can be toggled via `MCP_SERVER_URL` environment variable without code changes
- MCP status is clearly indicated in both the JSON metadata and HTML report with a visual badge
- Exit code is 0 if all tests pass, 1 if any tests fail
- LM Studio provider requires LM Studio to be running locally with a model loaded
