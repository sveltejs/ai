import { tool } from "ai";
import { z } from "zod";
import type { TestDefinition } from "../test-discovery.ts";
import {
  runTestVerification,
  cleanupTestEnvironment,
} from "../output-test-runner.ts";

export function testComponentTool(test: TestDefinition) {
  return tool({
    description:
      "Test your Svelte component against the test suite. Use this to verify your implementation and get feedback on any failing tests before submitting with ResultWrite. Returns detailed information about which tests passed or failed, as well as code validation results.",
    inputSchema: z.object({
      content: z
        .string()
        .describe("The complete Svelte component code to test"),
    }),
    execute: async ({ content }) => {
      const lines = content.split("\n").length;
      console.log(`[TestComponent] Testing ${lines} lines of code...`);

      try {
        const result = await runTestVerification(test, content);

        cleanupTestEnvironment(test.name);

        // Build response with validation info
        const response: {
          success: boolean;
          message: string;
          passed: number;
          failed: number;
          total: number;
          duration: number;
          error?: string;
          failedTests?: Array<{ name: string; error: string }>;
          validation?: {
            valid: boolean;
            errors: string[];
          };
          validationFailed?: boolean;
        } = {
          success: result.passed,
          message: result.validationFailed
            ? `Validation failed. ${result.numPassed}/${result.numTests} tests passed.`
            : result.passed
              ? `All ${result.numTests} tests passed!`
              : `${result.numFailed} of ${result.numTests} tests failed`,
          passed: result.numPassed,
          failed: result.numFailed,
          total: result.numTests,
          duration: result.duration,
          validationFailed: result.validationFailed,
        };

        // Include validation results if present
        if (result.validation) {
          response.validation = {
            valid: result.validation.valid,
            errors: result.validation.errors,
          };

          if (!result.validation.valid) {
            console.log(
              `[TestComponent] ✗ Validation failed: ${result.validation.errors.join(", ")}`,
            );
          } else {
            console.log(`[TestComponent] ✓ Validation passed`);
          }
        }

        if (result.passed) {
          console.log(`[TestComponent] ✓ All ${result.numTests} tests passed`);
        } else {
          console.log(
            `[TestComponent] ✗ ${result.numFailed}/${result.numTests} tests failed`,
          );

          if (result.error) {
            response.error = result.error;
          }

          if (result.failedTests) {
            response.failedTests = result.failedTests.map((ft) => ({
              name: ft.fullName,
              error: ft.errorMessage,
            }));
          }
        }

        return response;
      } catch (error) {
        cleanupTestEnvironment(test.name);
        console.log(`[TestComponent] ✗ Error running tests`);
        return {
          success: false,
          message: "Failed to run tests",
          passed: 0,
          failed: 0,
          total: 0,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
