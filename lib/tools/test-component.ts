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
      "Test your Svelte component against the test suite. Use this to verify your implementation and get feedback on any failing tests before submitting with ResultWrite. Returns detailed information about which tests passed or failed.",
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

        if (result.passed) {
          console.log(`[TestComponent] ✓ All ${result.numTests} tests passed`);
          return {
            success: true,
            message: `All ${result.numTests} tests passed!`,
            passed: result.numPassed,
            failed: result.numFailed,
            total: result.numTests,
            duration: result.duration,
          };
        } else {
          console.log(
            `[TestComponent] ✗ ${result.numFailed}/${result.numTests} tests failed`,
          );
          return {
            success: false,
            message: `${result.numFailed} of ${result.numTests} tests failed`,
            passed: result.numPassed,
            failed: result.numFailed,
            total: result.numTests,
            duration: result.duration,
            error: result.error,
            failedTests: result.failedTests?.map((ft) => ({
              name: ft.fullName,
              error: ft.errorMessage,
            })),
          };
        }
      } catch (error) {
        cleanupTestEnvironment(test.name);
        console.log(`[TestComponent] ✗ Error running tests`);
        return {
          success: false,
          message: "Failed to run tests",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}
