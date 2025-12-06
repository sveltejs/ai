## Project Overview

AI SDK benchmarking tool built with Vercel AI SDK and Bun runtime. Tests AI agents with MCP (Model Context Protocol) server integration, specifically using the Svelte MCP server for agent benchmarks.

## Development Commands

```bash
# Install dependencies (runs patch-package automatically)
bun install

# Run the main benchmark
bun run index.ts

# Generate HTML report from existing result.json
bun run generate-report.ts

# Run TypeScript type checking
bun tsc --noEmit
```

## Architecture

### Core Components

- **`index.ts`**: Main benchmark entry point

  - Creates an AI agent using `Experimental_Agent` from Vercel AI SDK
  - Configures MCP client to connect to Svelte MCP server at `https://mcp.svelte.dev/mcp`
  - Runs agent with a test prompt and captures results
  - Generates result.json with full agent execution trace
  - Automatically generates HTML report

- **`lib/report.ts`**: HTML report generation

  - Parses result.json containing agent execution steps
  - Renders detailed HTML visualization with:
    - User prompts and assistant responses
    - Tool calls and their inputs/outputs
    - Token usage statistics per step
    - Timestamps and metadata
  - Auto-opens report in default browser using `Bun.spawn(["open", ...])`

- **`generate-report.ts`**: Standalone report generator
  - Utility to regenerate HTML reports from existing result.json files

### Key Technologies

- **Vercel AI SDK v5**: Agent framework with tool calling
- **@ai-sdk/anthropic**: Anthropic provider (currently using `claude-haiku-4-5`)
- **@ai-sdk/mcp**: MCP client integration (with custom patch)
- **Bun Runtime**: JavaScript runtime (not Node.js)

### MCP Integration

The project uses `@ai-sdk/mcp` with a custom patch applied via `patch-package`:

- Patch location: `patches/@ai-sdk+mcp+0.0.11.patch`
- Fixes: Handles missing event types in HTTP SSE responses by treating undefined events as "message" events
- MCP server: Svelte documentation server providing Svelte-related tools

### Data Flow

1. Agent receives prompt with access to MCP tools
2. Agent iterates through steps, calling tools as needed
3. Each step is tracked with full request/response details
4. Agent stops when `ResultWrite` tool is called
5. Results written to `result.json` in root directory
6. HTML report generated in `results/result.html`

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
- HTML reports include collapsible tool input sections for better readability
- Token usage includes cached token counts when available
