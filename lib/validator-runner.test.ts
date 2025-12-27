import { describe, it, expect } from "vitest";
import { runValidator, hasValidator, getValidatorPath } from "./validator-runner.ts";
import type { TestDefinition } from "./test-discovery.ts";
import { join } from "node:path";

// Create a mock test definition
function createMockTest(name: string): TestDefinition {
  const directory = join(process.cwd(), "tests", name);
  return {
    name,
    directory,
    referenceFile: join(directory, "Reference.svelte"),
    componentFile: join(directory, "Component.svelte"),
    testFile: join(directory, "test.ts"),
    promptFile: join(directory, "prompt.md"),
    prompt: "Test prompt",
    testContent: "Test content",
  };
}

describe("validator-runner", () => {
  describe("hasValidator", () => {
    it("returns true for tests with validator.ts", () => {
      const test = createMockTest("counter");
      expect(hasValidator(test)).toBe(true);
    });

    it("returns false for tests without validator.ts", () => {
      const test = createMockTest("hello-world");
      expect(hasValidator(test)).toBe(false);
    });
  });

  describe("getValidatorPath", () => {
    it("returns path for tests with validator.ts", () => {
      const test = createMockTest("counter");
      const path = getValidatorPath(test);
      expect(path).toContain("counter");
      expect(path).toContain("validator.ts");
    });

    it("returns null for tests without validator.ts", () => {
      const test = createMockTest("hello-world");
      expect(getValidatorPath(test)).toBe(null);
    });
  });

  describe("runValidator", () => {
    it("returns null for tests without validator", async () => {
      const test = createMockTest("hello-world");
      const result = await runValidator(test, "<p>Hello</p>");
      expect(result).toBe(null);
    });

    it("validates counter component correctly - passing", async () => {
      const test = createMockTest("counter");
      const code = `
        <script>
          let count = $state(0);
        </script>
        <button>{count}</button>
      `;
      const result = await runValidator(test, code);
      expect(result).not.toBe(null);
      expect(result?.valid).toBe(true);
      expect(result?.errors).toHaveLength(0);
    });

    it("validates counter component correctly - failing", async () => {
      const test = createMockTest("counter");
      const code = `
        <script>
          let count = 0;
        </script>
        <button>{count}</button>
      `;
      const result = await runValidator(test, code);
      expect(result).not.toBe(null);
      expect(result?.valid).toBe(false);
      expect(result?.errors.length).toBeGreaterThan(0);
    });

    it("validates derived-by component correctly - passing", async () => {
      const test = createMockTest("derived-by");
      const code = `
        <script>
          let text = $state("");
          let stats = $derived.by(() => ({ wordCount: 0 }));
        </script>
      `;
      const result = await runValidator(test, code);
      expect(result).not.toBe(null);
      expect(result?.valid).toBe(true);
    });

    it("validates derived-by component correctly - failing without $derived.by", async () => {
      const test = createMockTest("derived-by");
      const code = `
        <script>
          let text = $state("");
          let stats = $derived({ wordCount: 0 });
        </script>
      `;
      const result = await runValidator(test, code);
      expect(result).not.toBe(null);
      expect(result?.valid).toBe(false);
      expect(result?.errors).toContain(
        "Component must use the $derived.by rune for complex derivations",
      );
    });

    it("validates snippets component correctly - passing", async () => {
      const test = createMockTest("snippets");
      const code = `
        {#snippet title(name)}
          <span>{name}</span>
        {/snippet}
        {@render title("Test")}
      `;
      const result = await runValidator(test, code);
      expect(result).not.toBe(null);
      expect(result?.valid).toBe(true);
    });

    it("validates snippets component correctly - failing", async () => {
      const test = createMockTest("snippets");
      const code = `
        <ul>
          {#each items as item}
            <li>{item}</li>
          {/each}
        </ul>
      `;
      const result = await runValidator(test, code);
      expect(result).not.toBe(null);
      expect(result?.valid).toBe(false);
      expect(result?.errors.length).toBe(2);
    });
  });
});
