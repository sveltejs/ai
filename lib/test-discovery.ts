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
  testContent: string;
}

export function discoverTests(): TestDefinition[] {
  const testsDir = join(process.cwd(), "tests");
  const definitions: TestDefinition[] = [];

  try {
    const entries = readdirSync(testsDir);

    for (const entry of entries) {
      const entryPath = join(testsDir, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        const referenceFile = join(entryPath, "Reference.svelte");
        let testFile = join(entryPath, "test.ts");
        if (!existsSync(testFile)) {
          testFile = join(entryPath, "test.svelte.ts");
        }
        const promptFile = join(entryPath, "prompt.md");
        const componentFile = join(entryPath, "Component.svelte");

        if (
          existsSync(referenceFile) &&
          existsSync(testFile) &&
          existsSync(promptFile)
        ) {
          const prompt = readFileSync(promptFile, "utf-8");
          const testContent = readFileSync(testFile, "utf-8");

          definitions.push({
            name: entry,
            directory: entryPath,
            referenceFile,
            componentFile,
            testFile,
            promptFile,
            prompt,
            testContent,
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
