# ai-sdk-bench

AI SDK benchmarking tool that tests AI agents with MCP (Model Context Protocol) integration. Automatically discovers and runs all tests in the `tests/` directory, verifying LLM-generated Svelte components against test suites.

## Installation

To install dependencies:

```bash
bun install
```

## Setup

To set up `.env`:

```bash
cp .env.example .env
```

Then configure your API keys and model in `.env`:

```bash
# Required: Choose your model
MODEL=anthropic/claude-sonnet-4
ANTHROPIC_API_KEY=your_key_here

# Optional: Enable MCP integration (leave empty to disable)
MCP_SERVER_URL=https://mcp.svelte.dev/mcp
```

### Environment Variables

**Required:**

- `MODEL`: The AI model to use (e.g., `anthropic/claude-sonnet-4`, `openai/gpt-5`, `openrouter/anthropic/claude-sonnet-4`, `lmstudio/model-name`)
- Corresponding API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`)
  - Note: No API key required for `lmstudio/*` models (runs locally)

**Optional:**

- `MCP_SERVER_URL`: MCP server URL (leave empty to disable MCP integration)

### Supported Providers

**Cloud Providers:**

- `anthropic/*` - Direct Anthropic API (requires `ANTHROPIC_API_KEY`)
- `openai/*` - Direct OpenAI API (requires `OPENAI_API_KEY`)
- `openrouter/*` - OpenRouter unified API (requires `OPENROUTER_API_KEY`)

**Local Providers:**

- `lmstudio/*` - LM Studio local server (requires LM Studio running on `http://localhost:1234`)

Example configurations:

```bash
# Anthropic
MODEL=anthropic/claude-sonnet-4
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
MODEL=openai/gpt-5
OPENAI_API_KEY=sk-...

# OpenRouter
MODEL=openrouter/anthropic/claude-sonnet-4
OPENROUTER_API_KEY=sk-or-...

# LM Studio (local)
MODEL=lmstudio/llama-3-8b
# No API key needed - make sure LM Studio is running!
```

## Usage

To run the benchmark (automatically discovers and runs all tests):

```bash
bun run index.ts
```

The benchmark will:

1. Discover all tests in `tests/` directory
2. For each test:
   - Run the AI agent with the test's prompt
   - Extract the generated Svelte component
   - Verify the component against the test suite
3. Generate a combined report with all results

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

The tool supports optional integration with MCP (Model Context Protocol) servers:

- **Enabled**: Set `MCP_SERVER_URL` to a valid MCP server URL
- **Disabled**: Leave `MCP_SERVER_URL` empty or unset

MCP status is documented in both the JSON metadata and displayed as a badge in the HTML report.

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
