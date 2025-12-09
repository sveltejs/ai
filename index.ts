import { Experimental_Agent as Agent, hasToolCall, stepCountIs } from "ai";
import { experimental_createMCPClient as createMCPClient } from "./node_modules/@ai-sdk/mcp/dist/index.mjs";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "./node_modules/@ai-sdk/mcp/dist/mcp-stdio/index.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
  generateReport,
  type SingleTestResult,
  type MultiTestResultData,
  type PricingInfo,
  type TotalCostInfo,
} from "./lib/report.ts";
import { getModelProvider, loadEnvConfig } from "./lib/providers.ts";
import {
  discoverTests,
  buildAgentPrompt,
  type TestDefinition,
} from "./lib/test-discovery.ts";
import {
  setupOutputsDirectory,
  cleanupOutputsDirectory,
  cleanupTestEnvironment,
  runTestVerification,
} from "./lib/output-test-runner.ts";
import { resultWriteTool, testComponentTool } from "./lib/tools/index.ts";
import {
  getModelPricingDisplay,
  calculateCost,
  formatCost,
  isPricingAvailable,
} from "./lib/pricing.ts";
import type { LanguageModel } from "ai";

/**
 * Generate a timestamped filename
 */
function getTimestampedFilename(prefix: string, extension: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${prefix}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.${extension}`;
}

/**
 * Parse a command string into command and args
 * Example: "npx -y @sveltejs/mcp" -> { command: "npx", args: ["-y", "@sveltejs/mcp"] }
 */
function parseCommandString(commandString: string): {
  command: string;
  args: string[];
} {
  const parts = commandString.trim().split(/\s+/);
  const command = parts[0] ?? "";
  const args = parts.slice(1);
  return { command, args };
}

/**
 * Check if a string is an HTTP/HTTPS URL
 */
function isHttpUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Extract ResultWrite content from agent steps
 */
function extractResultWriteContent(steps: unknown[]): string | null {
  for (const step of steps) {
    const s = step as {
      content?: Array<{
        type: string;
        toolName?: string;
        input?: { content: string };
      }>;
    };
    if (s.content) {
      for (const content of s.content) {
        if (
          content.type === "tool-call" &&
          content.toolName === "ResultWrite"
        ) {
          return content.input?.content ?? null;
        }
      }
    }
  }
  return null;
}

/**
 * Calculate total cost from test results
 */
function calculateTotalCost(
  tests: SingleTestResult[],
  modelString: string,
): TotalCostInfo | null {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedInputTokens = 0;

  for (const test of tests) {
    for (const step of test.steps) {
      totalInputTokens += step.usage.inputTokens;
      totalOutputTokens += step.usage.outputTokens;
      totalCachedInputTokens += step.usage.cachedInputTokens ?? 0;
    }
  }

  const costResult = calculateCost(
    modelString,
    totalInputTokens,
    totalOutputTokens,
    totalCachedInputTokens,
  );

  if (!costResult) return null;

  return {
    inputCost: costResult.inputCost,
    outputCost: costResult.outputCost,
    cacheReadCost: costResult.cacheReadCost,
    totalCost: costResult.totalCost,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cachedInputTokens: totalCachedInputTokens,
  };
}

/**
 * Run a single test with the AI agent
 */
async function runSingleTest(
  test: TestDefinition,
  model: LanguageModel,
  mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null,
  testComponentEnabled: boolean,
  testIndex: number,
  totalTests: number,
): Promise<SingleTestResult> {
  console.log(`\n[${testIndex + 1}/${totalTests}] Running test: ${test.name}`);
  console.log("─".repeat(50));

  const prompt = buildAgentPrompt(test);

  try {
    // Build tools object with conditional tools
    const tools = {
      ResultWrite: resultWriteTool,
      ...(testComponentEnabled && { TestComponent: testComponentTool(test) }),
      ...(mcpClient ? await mcpClient.tools() : {}),
    };

    // Create agent for this test
    let stepCounter = 0;
    const agent = new Agent({
      model,
      stopWhen: [hasToolCall("ResultWrite"), stepCountIs(10)],
      tools,
      onStepFinish: (step) => {
        if (process.env.VERBOSE_LOGGING !== "true") {
          return;
        }
        stepCounter++;
        console.log(`  Step ${stepCounter}:`);
        if (step.text) {
          const preview =
            step.text.length > 100
              ? step.text.slice(0, 100) + "..."
              : step.text;
          console.log(`💬 Text: ${preview}`);
        }
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const call of step.toolCalls) {
            if (call) {
              console.log(`🔧 Tool call: ${call.toolName}`);
            }
          }
        }
        if (step.toolResults && step.toolResults.length > 0) {
          for (const result of step.toolResults) {
            if (result && "output" in result) {
              const resultStr = JSON.stringify(result.output);
              const preview =
                resultStr.length > 80
                  ? resultStr.slice(0, 80) + "..."
                  : resultStr;
              console.log(`📤 Tool result: ${preview}`);
            }
          }
        }
      },
    });

    // Run the agent
    console.log("  ⏳ Running agent...");
    if (testComponentEnabled) {
      console.log("  📋 TestComponent tool is available");
    }
    const result = await agent.generate({ prompt });

    // Extract the generated component code
    const resultWriteContent = extractResultWriteContent(result.steps);

    if (!resultWriteContent) {
      console.log("  ⚠️  No ResultWrite output found");
      return {
        testName: test.name,
        prompt: test.prompt,
        steps: result.steps as unknown as SingleTestResult["steps"],
        resultWriteContent: null,
        verification: null,
      };
    }

    console.log("  ✓ Component generated");

    // Run test verification
    console.log("  ⏳ Verifying against tests...");
    const verification = await runTestVerification(test, resultWriteContent);

    if (verification.passed) {
      console.log(
        `✓ All tests passed (${verification.numPassed}/${verification.numTests})`,
      );
    } else {
      console.log(
        `✗ Tests failed (${verification.numFailed}/${verification.numTests} failed)`,
      );
      if (verification.failedTests) {
        for (const ft of verification.failedTests) {
          console.log(`- ${ft.fullName}`);
        }
      }
    }

    // Clean up this test's output directory
    cleanupTestEnvironment(test.name);

    return {
      testName: test.name,
      prompt: test.prompt,
      steps: result.steps as unknown as SingleTestResult["steps"],
      resultWriteContent,
      verification,
    };
  } catch (error) {
    console.error(`✗ Error running test: ${error}`);
    return {
      testName: test.name,
      prompt: test.prompt,
      steps: [],
      resultWriteContent: null,
      verification: {
        testName: test.name,
        passed: false,
        numTests: 0,
        numPassed: 0,
        numFailed: 0,
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// Main execution
async function main() {
  // Get MCP server URL/command from environment (optional)
  const mcpServerUrl = process.env.MCP_SERVER_URL || "";
  const mcpEnabled = mcpServerUrl.trim() !== "";

  // Check if TestComponent tool is disabled
  const testComponentEnabled = process.env.DISABLE_TESTCOMPONENT_TOOL !== "1";

  // Determine MCP transport type
  const isHttpTransport = mcpEnabled && isHttpUrl(mcpServerUrl);
  const mcpTransportType = isHttpTransport ? "HTTP" : "StdIO";

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║            SvelteBench 2.0 - Multi-Test            ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log(`Model: ${process.env.MODEL}`);
  console.log(`MCP Integration: ${mcpEnabled ? "Enabled" : "Disabled"}`);
  if (mcpEnabled) {
    console.log(`MCP Transport: ${mcpTransportType}`);
    if (isHttpTransport) {
      console.log(`MCP Server URL: ${mcpServerUrl}`);
    } else {
      console.log(`MCP StdIO Command: ${mcpServerUrl}`);
    }
  }
  console.log(
    `TestComponent Tool: ${testComponentEnabled ? "Enabled" : "Disabled"}`,
  );

  // Check pricing availability
  const hasPricing = isPricingAvailable();
  console.log(`Pricing Data: ${hasPricing ? "Available" : "Not available (run 'bun run update-model-pricing' to download)"}`);

  // Discover all tests
  console.log("\n📁 Discovering tests...");
  const tests = discoverTests();
  console.log(
    `Found ${tests.length} test(s): ${tests.map((t) => t.name).join(", ")}`,
  );

  if (tests.length === 0) {
    console.error("No tests found in tests/ directory");
    process.exit(1);
  }

  // Set up outputs directory
  setupOutputsDirectory();

  // Conditionally create MCP client based on transport type
  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  if (mcpEnabled) {
    if (isHttpTransport) {
      // HTTP transport
      mcpClient = await createMCPClient({
        transport: {
          type: "http",
          url: mcpServerUrl,
        },
      });
    } else {
      // StdIO transport - treat mcpServerUrl as command string
      const { command, args } = parseCommandString(mcpServerUrl);
      mcpClient = await createMCPClient({
        transport: new StdioMCPTransport({
          command,
          args,
        }),
      });
    }
  }

  // Load environment configuration and get model provider
  const envConfig = loadEnvConfig();
  const model = getModelProvider(envConfig);

  // Run all tests
  const testResults: SingleTestResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    if (!test) continue;
    const result = await runSingleTest(
      test,
      model,
      mcpClient,
      testComponentEnabled,
      i,
      tests.length,
    );
    testResults.push(result);
  }

  const totalDuration = Date.now() - startTime;

  // Clean up outputs directory
  cleanupOutputsDirectory();

  // Print summary
  console.log("\n" + "═".repeat(50));
  console.log("📊 Test Summary");
  console.log("═".repeat(50));

  const passed = testResults.filter((r) => r.verification?.passed).length;
  const failed = testResults.filter(
    (r) => r.verification && !r.verification.passed,
  ).length;
  const skipped = testResults.filter((r) => !r.verification).length;

  for (const result of testResults) {
    const status = result.verification
      ? result.verification.passed
        ? "✓"
        : "✗"
      : "⊘";
    const statusText = result.verification
      ? result.verification.passed
        ? "PASSED"
        : "FAILED"
      : "SKIPPED";
    console.log(`${status} ${result.testName}: ${statusText}`);
  }

  console.log("─".repeat(50));
  console.log(
    `Total: ${passed} passed, ${failed} failed, ${skipped} skipped (${(totalDuration / 1000).toFixed(1)}s)`,
  );

  // Calculate total cost
  const totalCost = calculateTotalCost(testResults, envConfig.modelString);
  const pricingDisplay = getModelPricingDisplay(envConfig.modelString);

  if (totalCost) {
    console.log("\n💰 Cost Summary");
    console.log("─".repeat(50));
    console.log(`Input tokens: ${totalCost.inputTokens.toLocaleString()} (${formatCost(totalCost.inputCost)})`);
    console.log(`Output tokens: ${totalCost.outputTokens.toLocaleString()} (${formatCost(totalCost.outputCost)})`);
    if (totalCost.cachedInputTokens > 0) {
      console.log(`Cached tokens: ${totalCost.cachedInputTokens.toLocaleString()} (${formatCost(totalCost.cacheReadCost)})`);
    }
    console.log(`Total cost: ${formatCost(totalCost.totalCost)}`);
  }

  // Ensure results directory exists
  const resultsDir = "results";
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  // Generate timestamped filenames
  const jsonFilename = getTimestampedFilename("result", "json");
  const htmlFilename = getTimestampedFilename("result", "html");
  const jsonPath = `${resultsDir}/${jsonFilename}`;
  const htmlPath = `${resultsDir}/${htmlFilename}`;

  // Build pricing info for metadata
  const pricing: PricingInfo | null = pricingDisplay
    ? {
        inputCostPerMTok: pricingDisplay.inputCostPerMTok,
        outputCostPerMTok: pricingDisplay.outputCostPerMTok,
        cacheReadCostPerMTok: pricingDisplay.cacheReadCostPerMTok,
      }
    : null;

  // Build the result data
  const resultData: MultiTestResultData = {
    tests: testResults,
    metadata: {
      mcpEnabled,
      mcpServerUrl: mcpEnabled ? mcpServerUrl : null,
      mcpTransportType: mcpEnabled ? mcpTransportType : null,
      timestamp: new Date().toISOString(),
      model: envConfig.modelString,
      pricing,
      totalCost,
    },
  };

  // Save result JSON
  writeFileSync(jsonPath, JSON.stringify(resultData, null, 2));
  console.log(`\n✓ Results saved to ${jsonPath}`);

  // Generate HTML report
  await generateReport(jsonPath, htmlPath);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
