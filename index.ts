import { Experimental_Agent as Agent, stepCountIs, tool } from "ai";
import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { generateReport } from "./lib/report.ts";

/*
const mcp_client = await createMCPClient({
  transport: {
    type: "http",
    url: "https://mcp.svelte.dev/mcp",
  },
});
*/

const mcp_client = await createMCPClient({
  transport: {
    type: "stdio",
    url: "https://mcp.svelte.dev/mcp",
  },
});

const svelte_agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  // tools: await mcp_client.tools(),
  stopWhen: stepCountIs(5),
  tools: {
    ResultWrite: tool({
      description: "Write content to a result file",
      inputSchema: z.object({
        content: z.string().describe("The content to write to the result file"),
      }),
      execute: async ({ content }) => {
        console.log("[ResultWrite called]", content);
        return { success: true };
      },
    }),
  },
});

const result = await svelte_agent.generate({
  prompt:
    "Can you build a counter component in svelte? Use the ResultWrite tool to write the result to a file when you are done.",
});

writeFileSync("result.json", JSON.stringify(result, null, 2));

// Generate HTML report
await generateReport("result.json", "results/result.html");
