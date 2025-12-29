import { describe, it, expect, afterEach } from "vitest";
import { runTestVerification, getExpectedTestCount } from "./output-test-runner.ts";
import type { TestDefinition } from "./test-discovery.ts";
import { join } from "node:path";
import { readFileSync } from "node:fs";

// Reset exit code after each test since runTestVerification runs inner Vitest
// tests that may fail (expected behavior) and set process.exitCode = 1
afterEach(() => {
  process.exitCode = 0;
});

// Create a mock test definition that uses real test files
function createMockTest(name: string): TestDefinition {
  const directory = join(process.cwd(), "tests", name);
  const testFile = join(directory, "test.ts");
  const promptFile = join(directory, "prompt.md");

  return {
    name,
    directory,
    referenceFile: join(directory, "Reference.svelte"),
    componentFile: join(directory, "Component.svelte"),
    testFile,
    promptFile,
    prompt: readFileSync(promptFile, "utf-8"),
    testContent: readFileSync(testFile, "utf-8"),
  };
}

describe("getExpectedTestCount", () => {
  it("returns correct test count for counter test", async () => {
    const test = createMockTest("counter");
    const count = await getExpectedTestCount(test);
    expect(count).toBe(4); // counter has 4 tests
  });

  it("returns correct test count for hello-world test", async () => {
    const test = createMockTest("hello-world");
    const count = await getExpectedTestCount(test);
    expect(count).toBe(2); // hello-world has 2 tests
  });

  it("returns correct test count for snippets test", async () => {
    const test = createMockTest("snippets");
    const count = await getExpectedTestCount(test);
    expect(count).toBe(3); // snippets has 3 tests
  });
});

describe("runTestVerification", () => {
  it("sets validationFailed: true when validation fails", async () => {
    const test = createMockTest("counter");

    // Invalid component code that will fail validation
    const invalidCode = `<script>
  let count;
</script>
<button>Click</button>`;

    const result = await runTestVerification(test, invalidCode);

    expect(result.validationFailed).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.validation).toBeDefined();
    expect(result.validation?.valid).toBe(false);
  });

  it("does not set validationFailed when validation passes", async () => {
    const test = createMockTest("counter");

    // Valid component code that should pass validation
    const validCode = `<script>
  let count = $state(0);
</script>
<button onclick={() => count++}>count is {count}</button>`;

    const result = await runTestVerification(test, validCode);

    expect(result.validationFailed).not.toBe(true);
  });

  it("does not set validationFailed when no validator exists", async () => {
    const test = createMockTest("hello-world");

    const code = `<h1>Hello World</h1>`;

    const result = await runTestVerification(test, code);

    expect(result.validationFailed).not.toBe(true);
  });

  it("returns expected test count when component cannot be imported", async () => {
    const test = createMockTest("counter");

    // Invalid component that can't compile
    const brokenCode = `<script>
  this is not valid code at all {{{{
</script>`;

    const result = await runTestVerification(test, brokenCode);

    // Should use expected test count from Reference even though tests couldn't run
    expect(result.numTests).toBe(4); // counter has 4 tests
    expect(result.numPassed).toBe(0);
    expect(result.numFailed).toBe(4);
    expect(result.passed).toBe(false);
  });

  it("returns expected test count for snippets when validation fails", async () => {
    const test = createMockTest("snippets");

    // Component without required snippets syntax
    const invalidCode = `<ul>
  {#each ["a", "b", "c"] as item}
    <li>{item}</li>
  {/each}
</ul>`;

    const result = await runTestVerification(test, invalidCode);

    // Should get test count from Reference
    expect(result.numTests).toBe(3); // snippets has 3 tests
    expect(result.validationFailed).toBe(true);
  });
});
