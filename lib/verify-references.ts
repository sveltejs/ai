import {
  readdirSync,
  statSync,
  copyFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { startVitest } from "vitest/node";

interface TestDefinition {
  name: string;
  directory: string;
  referenceFile: string;
  componentFile: string;
  testFile: string;
  promptFile: string;
}

interface FailedTest {
  fullName: string;
  errorMessage: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  numTests: number;
  numPassed: number;
  numFailed: number;
  duration: number;
  error?: string;
  failedTests?: FailedTest[];
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
          console.warn(
            `⚠️  Skipping ${entry}: missing Reference.svelte or test.ts`,
          );
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
  const startTime = Date.now();

  try {
    // Run vitest programmatically
    const vitest = await startVitest("test", [testDef.testFile], {
      watch: false,
      reporters: ["verbose"],
    });

    if (!vitest) {
      return {
        testName: testDef.name,
        passed: false,
        numTests: 0,
        numPassed: 0,
        numFailed: 0,
        duration: Date.now() - startTime,
        error: "Failed to start vitest",
      };
    }

    await vitest.close();

    const testModules = vitest.state.getTestModules();
    const failedTests: FailedTest[] = [];
    const allErrors: string[] = [];

    // Get unhandled errors
    const unhandledErrors = vitest.state.getUnhandledErrors();
    for (const error of unhandledErrors) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      allErrors.push(errorMessage);
    }

    // Calculate success/failure
    let passed = true;
    let numTests = 0;
    let numFailed = 0;

    if (!testModules || testModules.length === 0) {
      return {
        testName: testDef.name,
        passed: false,
        numTests: 0,
        numPassed: 0,
        numFailed: 0,
        duration: Date.now() - startTime,
        error:
          allErrors.length > 0 ? allErrors.join("\n") : "No test modules found",
      };
    }

    for (const module of testModules) {
      if (!module.ok()) {
        passed = false;
      }

      // Add module errors
      const moduleErrors = module.errors();
      for (const error of moduleErrors) {
        if (error.message) {
          allErrors.push(error.message);
        }
      }

      if (!module.children) {
        continue;
      }

      try {
        const tests = Array.from(module.children.allTests());
        numTests += tests.length;

        for (const t of tests) {
          const result = t.result();

          if (result.state === "failed") {
            numFailed++;

            // Build full test name from ancestor titles
            const ancestorTitles: string[] = [];
            let parent = t.parent;
            while (parent && "name" in parent) {
              if (parent.name) {
                ancestorTitles.unshift(parent.name);
              }
              parent = (
                "parent" in parent
                  ? (parent as { parent?: unknown }).parent
                  : undefined
              ) as typeof parent;
            }

            const fullName =
              ancestorTitles.length > 0
                ? `${ancestorTitles.join(" > ")} > ${t.name}`
                : t.name;

            // Collect error messages
            const errorMessages: string[] = [];
            if (result.errors) {
              for (const testError of result.errors) {
                if (testError.message) {
                  errorMessages.push(testError.message);
                  allErrors.push(testError.message);
                }
              }
            }

            failedTests.push({
              fullName,
              errorMessage:
                errorMessages.join("\n") || "No error message available",
            });
          }
        }
      } catch (err) {
        console.error(
          `Error processing module tests for ${testDef.name}:`,
          err,
        );
        const errorMessage = err instanceof Error ? err.message : String(err);
        allErrors.push(errorMessage);
        passed = false;
      }
    }

    const numPassed = numTests - numFailed;

    return {
      testName: testDef.name,
      passed: passed && numFailed === 0,
      numTests,
      numPassed,
      numFailed,
      duration: Date.now() - startTime,
      failedTests: failedTests.length > 0 ? failedTests : undefined,
      error: allErrors.length > 0 && !passed ? allErrors[0] : undefined,
    };
  } catch (error) {
    return {
      testName: testDef.name,
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      duration: Date.now() - startTime,
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

    if (!result.passed && result.failedTests && result.failedTests.length > 0) {
      console.log("  Failed tests:");
      for (const failed of result.failedTests) {
        console.log(`✗ ${failed.fullName}`);
      }
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
        console.log(
          `  ✗ Tests failed (${result.numFailed}/${result.numTests} failed)`,
        );
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
        if (result.failedTests && result.failedTests.length > 0) {
          console.log("\n  Failed tests:");
          for (const failed of result.failedTests) {
            console.log(`✗ ${failed.fullName}`);
            // Print error message with indentation
            const errorLines = failed.errorMessage.split("\n");
            for (const line of errorLines) {
              if (line.trim()) {
                console.log(` ${line}`);
              }
            }
          }
          console.log();
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
