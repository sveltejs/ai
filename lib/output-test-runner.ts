import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { startVitest } from "vitest/node";
import type { TestDefinition } from "./test-discovery.ts";
import { runValidator, type ValidationResult } from "./validator-runner.ts";

const OUTPUTS_DIR = join(process.cwd(), "outputs");

export interface FailedTest {
  fullName: string;
  errorMessage: string;
}

export interface TestVerificationResult {
  testName: string;
  passed: boolean;
  numTests: number;
  numPassed: number;
  numFailed: number;
  duration: number;
  error?: string;
  failedTests?: FailedTest[];
  validation?: ValidationResult | null;
  validationFailed?: boolean;
}

export function setupOutputsDirectory() {
  if (existsSync(OUTPUTS_DIR)) {
    rmSync(OUTPUTS_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUTPUTS_DIR, { recursive: true });
}

export function cleanupOutputsDirectory() {
  if (existsSync(OUTPUTS_DIR)) {
    rmSync(OUTPUTS_DIR, { recursive: true, force: true });
  }
}

export function prepareTestEnvironment(
  test: TestDefinition,
  componentCode: string,
) {
  const testDir = join(OUTPUTS_DIR, test.name);

  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  mkdirSync(testDir, { recursive: true });

  const componentPath = join(testDir, "Component.svelte");
  writeFileSync(componentPath, componentCode, "utf-8");

  const testFilePath = join(testDir, "test.svelte.ts");
  copyFileSync(test.testFile, testFilePath);

  return testDir;
}

export function cleanupTestEnvironment(testName: string) {
  const testDir = join(OUTPUTS_DIR, testName);
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

/**
 * Get the expected test count by running Vitest against the Reference implementation.
 * If we just invoke startVitest directly on an invalid component, we can't get the actual test
 * count since Vitest borks and doesn't load any tests.
 */
export async function getExpectedTestCount(
  test: TestDefinition,
): Promise<number> {
  const testDir = join(OUTPUTS_DIR, `${test.name}-reference-count`);

  try {
    // Setup temp directory with Reference component
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Copy Reference as Component.svelte
    const componentPath = join(testDir, "Component.svelte");
    copyFileSync(test.referenceFile, componentPath);

    // Copy test file
    const testFilePath = join(testDir, "test.ts");
    copyFileSync(test.testFile, testFilePath);

    // Run vitest to collect tests
    const vitest = await startVitest("test", [testFilePath], {
      watch: false,
      reporters: [],
      run: true,
    });

    if (!vitest) {
      return 0;
    }

    await vitest.close();

    // Count tests from modules
    const testModules = vitest.state.getTestModules();
    let testCount = 0;

    for (const module of testModules) {
      if (module.children) {
        const tests = Array.from(module.children.allTests());
        testCount += tests.length;
      }
    }

    return testCount;
  } catch (error) {
    console.error(`Error getting expected test count for ${test.name}:`, error);
    return 0;
  } finally {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }
}

export async function runTestVerification(
  test: TestDefinition,
  componentCode: string,
): Promise<TestVerificationResult> {
  const startTime = Date.now();

  const validation = await runValidator(test, componentCode);
  const validationFailed = validation ? !validation.valid : undefined;

  try {
    const testDir = prepareTestEnvironment(test, componentCode);
    const testFilePath = join(testDir, "test.svelte.ts");

    const vitest = await startVitest("test", [testFilePath], {
      watch: false,
      reporters: ["verbose"],
    });

    if (!vitest) {
      // Get expected test count from Reference
      const expectedTestCount = await getExpectedTestCount(test);

      return {
        testName: test.name,
        passed: false,
        numTests: expectedTestCount,
        numPassed: 0,
        numFailed: expectedTestCount,
        duration: Date.now() - startTime,
        error: "Failed to start vitest",
        validation,
        validationFailed,
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
      // Get expected test count from Reference when no modules found
      const expectedTestCount = await getExpectedTestCount(test);

      // Add validation errors to allErrors if validation failed
      if (validationFailed && validation) {
        const validationError = `Validation failed: ${validation.errors.join("; ")}`;
        allErrors.unshift(validationError);
      }

      return {
        testName: test.name,
        passed: false,
        numTests: expectedTestCount,
        numPassed: 0,
        numFailed: expectedTestCount,
        duration: Date.now() - startTime,
        error:
          allErrors.length > 0 ? allErrors.join("\n") : "No test modules found",
        validation,
        validationFailed,
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
        console.error(`Error processing module tests for ${test.name}:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        allErrors.push(errorMessage);
        passed = false;
      }
    }

    // If we got 0 tests from vitest but component couldn't load, get count from Reference
    if (numTests === 0) {
      const expectedTestCount = await getExpectedTestCount(test);
      if (expectedTestCount > 0) {
        numTests = expectedTestCount;
        numFailed = expectedTestCount;
      }
    }

    const numPassed = numTests - numFailed;

    // Add validation errors to allErrors if validation failed
    if (validationFailed && validation) {
      const validationError = `Validation failed: ${validation.errors.join("; ")}`;
      allErrors.unshift(validationError);
    }

    return {
      testName: test.name,
      passed: !validationFailed && passed && numFailed === 0,
      numTests,
      numPassed,
      numFailed,
      duration: Date.now() - startTime,
      failedTests: failedTests.length > 0 ? failedTests : undefined,
      error: allErrors.length > 0 ? allErrors[0] : undefined,
      validation,
      validationFailed,
    };
  } catch (error) {
    // Get expected test count on error
    const expectedTestCount = await getExpectedTestCount(test);

    return {
      testName: test.name,
      passed: false,
      numTests: expectedTestCount,
      numPassed: 0,
      numFailed: expectedTestCount,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      validation,
      validationFailed,
    };
  }
}
