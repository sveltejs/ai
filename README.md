# ai-sdk-bench

AI SDK benchmarking tool that tests AI agents with MCP (Model Context Protocol) integration using the Vercel AI Gateway. Automatically discovers and runs all tests in the `tests/` directory, verifying LLM-generated Svelte components against test suites.

## Installation

To install dependencies:

```bash
bun install
```

## Setup

Configure your API keys in `.env`:

1. Install Vercel CLI if you haven't already
2. Run `bun run vercel:link` and link the benchmark to a project that has AI Gateway enabled
3. Run the benchmark with "bun run dev"

### Required API Keys

You'll need at least one API key for the providers you want to test:

- `VERCEL_OIDC_TOKEN`: The OIDC token for vercel AI gateway

## Usage

To run the benchmark:

```bash
bun run index.ts
```

### Interactive CLI

The benchmark features an interactive CLI that will prompt you for configuration:

1. **Model Selection**: Choose one or more models from the Vercel AI Gateway
   - Select from available models in your configured providers
   - Optionally add custom model IDs
   - Can test multiple models in a single run

2. **MCP Integration**: Choose your MCP configuration
   - **No MCP Integration**: Run without external tools
   - **MCP over HTTP**: Use HTTP-based MCP server (default: `https://mcp.svelte.dev/mcp`)
   - **MCP over StdIO**: Use local MCP server via command (default: `npx -y @sveltejs/mcp`)
   - Option to provide custom MCP server URL or command

3. **TestComponent Tool**: Enable/disable the testing tool for models
   - Allows models to run tests during component development
   - Enabled by default

### Benchmark Workflow

After configuration, the benchmark will:

1. Discover all tests in `tests/` directory
2. For each selected model and test:
   - Run the AI agent with the test's prompt
   - Extract the generated Svelte component
   - Verify the component against the test suite
3. Generate a combined report with all results

### Results and Reports

Results are saved to the `results/` directory with timestamped filenames:

- `results/result-2024-12-07-14-30-45.json` - Full execution trace with all test results
- `results/result-2024-12-07-14-30-45.html` - Interactive HTML report with expandable test sections

The HTML report includes:

- Summary bar showing passed/failed/skipped counts
- Expandable sections for each test
- Step-by-step execution trace
- Generated component code
- Test verification results with pass/fail details
- Token usage statistics
- MCP status badge
- Dark/light theme toggle

To regenerate an HTML report from a JSON file:

```bash
# Regenerate most recent result
bun run generate-report.ts

# Regenerate specific result
bun run generate-report.ts results/result-2024-12-07-14-30-45.json
```

## Test Structure

Each test in the `tests/` directory should have:

```
tests/
  {test-name}/
    Reference.svelte  - Reference implementation (known-good solution)
    test.ts          - Vitest test file (imports "./Component.svelte")
    prompt.md        - Prompt for the AI agent
```

The benchmark:

1. Reads the prompt from `prompt.md`
2. Asks the agent to generate a component
3. Writes the generated component to a temporary location
4. Runs the tests against the generated component
5. Reports pass/fail status

## Verifying Reference Implementations

To verify that all reference implementations pass their tests:

```bash
bun run verify-tests
```

This copies each `Reference.svelte` to `Component.svelte` temporarily and runs the tests.

## MCP Integration

The tool supports optional integration with MCP (Model Context Protocol) servers through the interactive CLI. When running the benchmark, you'll be prompted to choose:

- **No MCP Integration**: Run without external tools
- **MCP over HTTP**: Connect to an HTTP-based MCP server
  - Default: `https://mcp.svelte.dev/mcp`
  - Option to provide a custom URL
- **MCP over StdIO**: Connect to a local MCP server via command
  - Default: `npx -y @sveltejs/mcp`
  - Option to provide a custom command

MCP status, transport type, and server configuration are documented in both the JSON metadata and displayed as a badge in the HTML report.

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Documentation

See [AGENTS.md](AGENTS.md) for detailed documentation on:

- Architecture and components
- Environment variables and model configuration
- MCP integration details
- Development commands
- Multi-test result format

---

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
