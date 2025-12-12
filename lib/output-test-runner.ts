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

  const testFilePath = join(testDir, "test.ts");
  copyFileSync(test.testFile, testFilePath);

  return testDir;
}

export function cleanupTestEnvironment(testName: string) {
  const testDir = join(OUTPUTS_DIR, testName);
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

export async function runTestVerification(
  test: TestDefinition,
  componentCode: string,
) {
  const startTime = Date.now();

  try {
    const testDir = prepareTestEnvironment(test, componentCode);
    const testFilePath = join(testDir, "test.ts");

    const vitest = await startVitest("test", [testFilePath], {
      watch: false,
      reporters: ["verbose"],
    });

    if (!vitest) {
      return {
        testName: test.name,
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
        testName: test.name,
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
        console.error(`Error processing module tests for ${test.name}:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        allErrors.push(errorMessage);
        passed = false;
      }
    }

    const numPassed = numTests - numFailed;

    return {
      testName: test.name,
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
      testName: test.name,
      passed: false,
      numTests: 0,
      numPassed: 0,
      numFailed: 0,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
