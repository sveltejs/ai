import { tool } from "ai";
import { z } from "zod";

export const resultWriteTool = tool({
  description:
    "Write your final Svelte component code. Call this when you have completed implementing the component and are ready to submit.",
  inputSchema: z.object({
    content: z.string().describe("The complete Svelte component code"),
  }),
  execute: async ({ content }) => {
    const lines = content.split("\n").length;
    console.log(`[ResultWrite] Received ${lines} lines of code`);
    return { success: true };
  },
});
