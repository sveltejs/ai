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

export function loadTestDefinitions() {
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

export function copyReferenceToComponent(testDef: TestDefinition) {
  copyFileSync(testDef.referenceFile, testDef.componentFile);
}

export function cleanupComponent(testDef: TestDefinition) {
  if (existsSync(testDef.componentFile)) {
    try {
      unlinkSync(testDef.componentFile);
    } catch (error) {
      console.warn(`⚠️  Failed to cleanup ${testDef.componentFile}:`, error);
    }
  }
}

export async function runTest(testDef: TestDefinition) {
  const startTime = Date.now();

  try {
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
    const failedTests = [];
    const allErrors = [];

    const unhandledErrors = vitest.state.getUnhandledErrors();
    for (const error of unhandledErrors) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      allErrors.push(errorMessage);
    }

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

export function printSummary(results: TestResult[]) {
  console.log("\n=== Test Verification Summary ===\n");

  const totalSuites = results.length;
  const passedSuites = results.filter((r) => r.passed).length;

  for (const result of results) {
    const status = result.passed ? "✓ PASSED" : "✗ FAILED";
    const testInfo = `${result.numPassed}/${result.numTests} tests`;
    const durationInfo = `${result.duration}ms`;

    console.log(`${result.testName}: ${status} (${testInfo}, ${durationInfo})`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
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

export async function verifyAllReferences() {
  console.log("Discovering test suites...");
  const tests = loadTestDefinitions();
  console.log(`Found ${tests.length} test suite(s)\n`);

  if (tests.length === 0) {
    console.log("No test suites found in tests/ directory");
    return 1;
  }

  const results = [];

  for (const test of tests) {
    console.log(`Running tests/${test.name}...`);

    try {
      copyReferenceToComponent(test);
      console.log("  ✓ Copied Reference.svelte → Component.svelte");

      const result = await runTest(test);
      results.push(result);

      if (result.passed) {
        console.log(`✓ All tests passed (${result.duration}ms)`);
      } else {
        console.log(
          `✗ Tests failed (${result.numFailed}/${result.numTests} failed)`,
        );
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
        if (result.failedTests && result.failedTests.length > 0) {
          console.log("\n  Failed tests:");
          for (const failed of result.failedTests) {
            console.log(`✗ ${failed.fullName}`);
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
      cleanupComponent(test);
      console.log("  ✓ Cleaned up Component.svelte\n");
    }
  }

  printSummary(results);

  const allPassed = results.every((r) => r.passed);
  return allPassed ? 0 : 1;
}
