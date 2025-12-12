import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface TestDefinition {
  name: string;
  directory: string;
  referenceFile: string;
  componentFile: string;
  testFile: string;
  promptFile: string;
  prompt: string;
}

export function discoverTests() {
  const testsDir = join(process.cwd(), "tests");
  const definitions = [];

  try {
    const entries = readdirSync(testsDir);

    for (const entry of entries) {
      const entryPath = join(testsDir, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        const referenceFile = join(entryPath, "Reference.svelte");
        const testFile = join(entryPath, "test.ts");
        const promptFile = join(entryPath, "prompt.md");
        const componentFile = join(entryPath, "Component.svelte");

        if (
          existsSync(referenceFile) &&
          existsSync(testFile) &&
          existsSync(promptFile)
        ) {
          const prompt = readFileSync(promptFile, "utf-8");

          definitions.push({
            name: entry,
            directory: entryPath,
            referenceFile,
            componentFile,
            testFile,
            promptFile,
            prompt,
          });
        } else {
          const missing = [];
          if (!existsSync(referenceFile)) missing.push("Reference.svelte");
          if (!existsSync(testFile)) missing.push("test.ts");
          if (!existsSync(promptFile)) missing.push("prompt.md");
          console.warn(`⚠️  Skipping ${entry}: missing ${missing.join(", ")}`);
        }
      }
    }
  } catch (error) {
    console.error("Error discovering tests:", error);
  }

  definitions.sort((a, b) => a.name.localeCompare(b.name));

  return definitions;
}

export function buildAgentPrompt(test: TestDefinition) {
  return `${test.prompt}

IMPORTANT: When you have finished implementing the component, use the ResultWrite tool to output your final Svelte component code. Only output the component code itself, no explanations or markdown formatting.`;
}
