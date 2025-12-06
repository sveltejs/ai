import { Experimental_Agent as Agent, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
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

const svelte_agent = new Agent({
  model: anthropic("claude-haiku-4-5"),
  // tools: await mcp_client.tools(),
  stopWhen: stepCountIs(2),
});

const result = await svelte_agent.generate({
  prompt: "Can you build a counter component in svelte?",
});

writeFileSync("result.json", JSON.stringify(result, null, 2));

// Generate HTML report
await generateReport("result.json", "results/result.html");
