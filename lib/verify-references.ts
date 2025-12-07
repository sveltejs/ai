import { readdirSync, statSync, copyFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

interface TestDefinition {
  name: string;
  directory: string;
  referenceFile: string;
  componentFile: string;
  testFile: string;
  promptFile: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  numTests: number;
  numPassed: number;
  numFailed: number;
  duration: number;
  error?: string;
}

interface VitestJsonOutput {
  testResults: Array<{
    name: string;
    status: string;
    startTime: number;
    endTime: number;
  }>;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
}

/**
 * Load all test definitions from the tests/ directory
 */
export function loadTestDefinitions(): TestDefinition[] {
  const testsDir = join(process.cwd(), "tests");
  const definitions: TestDefinition[] = [];

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

        // Validate that required files exist
        if (existsSync(referenceFile) && existsSync(testFile)) {
          definitions.push({
            name: entry,
            directory: entryPath,
            referenceFile,
            componentFile,
            testFile,
            promptFile,
          });
        } else {
          console.warn(`⚠️  Skipping ${entry}: missing Reference.svelte or test.ts`);
        }
      }
    }
  } catch (error) {
    console.error("Error loading test definitions:", error);
  }

  return definitions;
}

/**
 * Copy Reference.svelte to Component.svelte
 */
export function copyReferenceToComponent(testDef: TestDefinition): void {
  copyFileSync(testDef.referenceFile, testDef.componentFile);
}

/**
 * Clean up Component.svelte file
 */
export function cleanupComponent(testDef: TestDefinition): void {
  if (existsSync(testDef.componentFile)) {
    try {
      unlinkSync(testDef.componentFile);
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup ${testDef.componentFile}:`, error);
    }
  }
}

/**
 * Run vitest on a specific test file and return the results
 */
export async function runTest(testDef: TestDefinition): Promise<TestResult> {
  try {
    const proc = Bun.spawn(["bun", "vitest", "run", testDef.testFile, "--reporter=json", "--no-coverage"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    // Parse JSON output from vitest
    let jsonOutput: VitestJsonOutput | null = null;

    // Vitest JSON reporter outputs JSON on stdout
    // We need to find the JSON object in the output
    const lines = stdout.split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("{")) {
        try {
          jsonOutput = JSON.parse(line);
          break;
        } catch {
          // Not valid JSON, continue
        }
      }
    }

    if (!jsonOutput) {
      // Failed to parse JSON, return error
      return {
        testName: testDef.name,
        passed: false,
        numTests: 0,
        numPassed: 0,
        numFailed: 0,
        duration: 0,
        error: "Failed to parse vitest output",
      };
    }

    // Calculate duration from test results
    let duration = 0;
    if (jsonOutput.testResults.length > 0) {
      const firstResult = jsonOutput.testResults[0];
      if (firstResult) {
        duration = firstResult.endTime - firstResult.startTime;
      }
    }

    return {
      testName: testDef.name,
      passed: jsonOutput.numFailedTests === 0,
      numTests: jsonOutput.numTotalTests,
      numPassed: jsonOutput.numPassedTests,
      numFailed: jsonOutput.numFailedTests,
      duration,
    };
  } catch (error) {
    return {
      testName: testDef.name,
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      duration: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print summary of test results
 */
export function printSummary(results: TestResult[]): void {
  console.log("\n=== Test Verification Summary ===\n");

  const totalSuites = results.length;
  const passedSuites = results.filter((r) => r.passed).length;

  for (const result of results) {
    const status = result.passed ? "✓ PASSED" : "✗ FAILED";
    const testInfo = `${result.numPassed}/${result.numTests} tests`;
    const durationInfo = `${result.duration}ms`;

    console.log(`${result.testName}: ${status} (${testInfo}, ${durationInfo})`);

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log(`\nTotal: ${passedSuites}/${totalSuites} suites passed`);

  if (passedSuites === totalSuites) {
    console.log("All reference implementations verified successfully!");
  } else {
    console.log(`${totalSuites - passedSuites} suite(s) failed.`);
  }
}

/**
 * Main function to verify all reference implementations
 */
export async function verifyAllReferences(): Promise<number> {
  console.log("Discovering test suites...");
  const tests = loadTestDefinitions();
  console.log(`Found ${tests.length} test suite(s)\n`);

  if (tests.length === 0) {
    console.log("No test suites found in tests/ directory");
    return 1;
  }

  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`Running tests/${test.name}...`);

    try {
      // Copy Reference.svelte to Component.svelte
      copyReferenceToComponent(test);
      console.log("  ✓ Copied Reference.svelte → Component.svelte");

      // Run the test
      const result = await runTest(test);
      results.push(result);

      if (result.passed) {
        console.log(`  ✓ All tests passed (${result.duration}ms)`);
      } else {
        console.log(`  ✗ Tests failed (${result.numFailed}/${result.numTests} failed)`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      }
    } finally {
      // Always cleanup Component.svelte
      cleanupComponent(test);
      console.log("  ✓ Cleaned up Component.svelte\n");
    }
  }

  // Print summary
  printSummary(results);

  // Return exit code
  const allPassed = results.every((r) => r.passed);
  return allPassed ? 0 : 1;
}
