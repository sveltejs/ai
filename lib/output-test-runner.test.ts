import { describe, it, expect } from "vitest";
import { runTestVerification } from "./output-test-runner.ts";
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

describe("output-test-runner", () => {
  describe("runTestVerification", () => {
    it("sets validationFailed: true when validation fails", async () => {
      // Use a test that has a validator (like counter)
      const test = createMockTest("counter");

      // Invalid component code that will fail validation
      const invalidCode = `<script>
  let count;
</script>
<button>Click</button>`;

      const result = await runTestVerification(test, invalidCode);

      // Should have validationFailed flag set
      expect(result.validationFailed).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.validation).toBeDefined();
      expect(result.validation?.valid).toBe(false);
    });

    it("does not set validationFailed when validation passes", async () => {
      // Use a test that has a validator
      const test = createMockTest("counter");

      // Valid component code that should pass validation
      const validCode = `<script>
  let count = $state(0);
</script>
<button onclick={() => count++}>count is {count}</button>`;

      const result = await runTestVerification(test, validCode);

      // Should not have validationFailed flag set (or should be false/undefined)
      expect(result.validationFailed).not.toBe(true);
    });

    it("does not set validationFailed when no validator exists", async () => {
      // Use a test without a validator (like hello-world)
      const test = createMockTest("hello-world");

      // Any component code
      const code = `<h1>Hello World</h1>`;

      const result = await runTestVerification(test, code);

      // Should not have validationFailed flag set
      expect(result.validationFailed).not.toBe(true);
    });
  });
});
