import { Experimental_Agent as Agent, hasToolCall, stepCountIs } from "ai";
import { experimental_createMCPClient as createMCPClient } from "./node_modules/@ai-sdk/mcp/dist/index.mjs";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "./node_modules/@ai-sdk/mcp/dist/mcp-stdio/index.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import {
  generateReport,
  type SingleTestResult,
} from "./lib/report.ts";
import {
  getTimestampedFilename,
  isHttpUrl,
  extractResultWriteContent,
  calculateTotalCost,
} from "./lib/utils.ts";
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
  buildPricingMap,
  lookupPricingFromMap,
  getModelPricingDisplay,
  formatCost,
  formatMTokCost,
  type ModelPricingLookup,
  type GatewayModel,
} from "./lib/pricing.ts";
import type { LanguageModel } from "ai";
import {
  intro,
  multiselect,
  isCancel,
  cancel,
  text,
  select,
  confirm,
  note,
} from "@clack/prompts";
import { gateway } from "ai";

async function validateAndConfirmPricing(
  models: string[],
  pricingMap: Map<string, ModelPricingLookup | null>,
) {
  const lookups = new Map<string, ModelPricingLookup | null>();

  for (const modelId of models) {
    const lookup = lookupPricingFromMap(modelId, pricingMap);
    lookups.set(modelId, lookup);
  }

  const modelsWithPricing = models.filter((m) => lookups.get(m) !== null);
  const modelsWithoutPricing = models.filter((m) => lookups.get(m) === null);

  if (modelsWithoutPricing.length === 0) {
    const pricingLines = models.map((modelId) => {
      const lookup = lookups.get(modelId)!;
      const display = getModelPricingDisplay(lookup.pricing);
      return `${modelId}\n  → ${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out`;
    });

    note(pricingLines.join("\n\n"), "💰 Pricing Found");

    const usePricing = await confirm({
      message: "Enable cost calculation?",
      initialValue: true,
    });

    if (isCancel(usePricing)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    return { enabled: usePricing, lookups };
  } else {
    const lines: string[] = [];

    if (modelsWithoutPricing.length > 0) {
      lines.push("No pricing found for:");
      for (const modelId of modelsWithoutPricing) {
        lines.push(`  ✗ ${modelId}`);
      }
    }

    if (modelsWithPricing.length > 0) {
      lines.push("");
      lines.push("Pricing available for:");
      for (const modelId of modelsWithPricing) {
        const lookup = lookups.get(modelId)!;
        const display = getModelPricingDisplay(lookup.pricing);
        lines.push(
          `  ✓ ${modelId} (${formatMTokCost(display.inputCostPerMTok)}/MTok in)`,
        );
      }
    }

    lines.push("");
    lines.push("Cost calculation will be disabled.");

    note(lines.join("\n"), "⚠️  Pricing Incomplete");

    const proceed = await confirm({
      message: "Continue without pricing?",
      initialValue: true,
    });

    if (isCancel(proceed) || !proceed) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    return { enabled: false, lookups };
  }
}

async function selectOptions() {
  intro("🚀 Svelte AI Bench");

  const availableModels = await gateway.getAvailableModels();

  const gatewayModels = availableModels.models as GatewayModel[];
  const pricingMap = buildPricingMap(gatewayModels);

  const models = await multiselect({
    message: "Select model(s) to benchmark",
    options: [{ value: "custom", label: "Custom" }].concat(
      availableModels.models.reduce<Array<{ value: string; label: string }>>(
        (arr, model) => {
          if (model.modelType === "language") {
            arr.push({ value: model.id, label: model.name });
          }
          return arr;
        },
        [],
      ),
    ),
  });

  if (isCancel(models)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  if (models.includes("custom")) {
    const customModel = await text({
      message: "Enter custom model id",
    });
    if (isCancel(customModel)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }
    models.push(customModel);
  }

  const selectedModels = models.filter((model) => model !== "custom");

  const pricing = await validateAndConfirmPricing(selectedModels, pricingMap);

  const mcpIntegration = await select({
    message: "Which MCP integration to use?",
    options: [
      { value: "none", label: "No MCP Integration" },
      { value: "http", label: "MCP over HTTP" },
      { value: "stdio", label: "MCP over StdIO" },
    ],
  });

  if (isCancel(mcpIntegration)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  let mcp: string | undefined = undefined;

  if (mcpIntegration !== "none") {
    const custom = await confirm({
      message: "Do you want to provide a custom MCP server/command?",
      initialValue: false,
    });

    if (isCancel(custom)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    if (custom) {
      const customMcp = await text({
        message: "Insert custom url or command",
      });
      if (isCancel(customMcp)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      mcp = customMcp;
    } else {
      mcp =
        mcpIntegration === "http"
          ? "https://mcp.svelte.dev/mcp"
          : "npx -y @sveltejs/mcp";
    }
  }

  const testingTool = await confirm({
    message: "Do you want to provide the testing tool to the model?",
    initialValue: true,
  });

  if (isCancel(testingTool)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return {
    models: selectedModels,
    mcp,
    testingTool,
    pricing,
  };
}

function parseCommandString(commandString: string): {
  command: string;
  args: string[];
} {
  const parts = commandString.trim().split(/\s+/);
  const command = parts[0] ?? "";
  const args = parts.slice(1);
  return { command, args };
}

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

  const fullPrompt = buildAgentPrompt(test);

  try {
    const tools = {
      ResultWrite: resultWriteTool,
      ...(testComponentEnabled && { TestComponent: testComponentTool(test) }),
      ...(mcpClient ? await mcpClient.tools() : {}),
    };

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

    console.log("  ⏳ Running agent...");
    if (testComponentEnabled) {
      console.log("  📋 TestComponent tool is available");
    }
    const result = await agent.generate({ prompt: fullPrompt });

    const resultWriteContent = extractResultWriteContent(result.steps);

    if (!resultWriteContent) {
      console.log("  ⚠️  No ResultWrite output found");
      return {
        testName: test.name,
        prompt: fullPrompt,
        steps: result.steps as unknown as SingleTestResult["steps"],
        resultWriteContent: null,
        verification: null,
      };
    }

    console.log("  ✓ Component generated");

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

    cleanupTestEnvironment(test.name);

    return {
      testName: test.name,
      prompt: fullPrompt,
      steps: result.steps as unknown as SingleTestResult["steps"],
      resultWriteContent,
      verification,
    };
  } catch (error) {
    console.error(`✗ Error running test: ${error}`);
    return {
      testName: test.name,
      prompt: fullPrompt,
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

async function main() {
  const { models, mcp, testingTool, pricing } = await selectOptions();

  const mcpServerUrl = mcp;
  const mcpEnabled = !!mcp;

  const testComponentEnabled = testingTool;

  const isHttpTransport = mcpServerUrl && isHttpUrl(mcpServerUrl);
  const mcpTransportType = isHttpTransport ? "HTTP" : "StdIO";

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║            SvelteBench 2.0 - Multi-Test            ║");
  console.log("╚════════════════════════════════════════════════════╝");

  console.log("\n📋 Models:");
  for (const modelId of models) {
    const lookup = pricing.lookups.get(modelId);
    if (pricing.enabled && lookup) {
      const display = getModelPricingDisplay(lookup.pricing);
      console.log(`   ${modelId}`);
      console.log(
        `      💰 ${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out`,
      );
    } else {
      console.log(`   ${modelId}`);
    }
  }

  console.log(`\n💰 Pricing: ${pricing.enabled ? "Enabled" : "Disabled"}`);

  console.log(`🔌 MCP Integration: ${mcpEnabled ? "Enabled" : "Disabled"}`);
  if (mcpEnabled) {
    console.log(`   Transport: ${mcpTransportType}`);
    if (isHttpTransport) {
      console.log(`   URL: ${mcpServerUrl}`);
    } else {
      console.log(`   Command: ${mcpServerUrl}`);
    }
  }

  console.log(
    `🧪 TestComponent Tool: ${testComponentEnabled ? "Enabled" : "Disabled"}`,
  );

  console.log("\n📁 Discovering tests...");
  const tests = discoverTests();
  console.log(
    `   Found ${tests.length} test(s): ${tests.map((t) => t.name).join(", ")}`,
  );

  if (tests.length === 0) {
    console.error("No tests found in tests/ directory");
    process.exit(1);
  }

  setupOutputsDirectory();

  let mcpClient = null;
  if (mcpEnabled) {
    if (isHttpTransport) {
      mcpClient = await createMCPClient({
        transport: {
          type: "http",
          url: mcpServerUrl,
        },
      });
    } else {
      const { command, args } = parseCommandString(mcpServerUrl!);
      mcpClient = await createMCPClient({
        transport: new StdioMCPTransport({
          command,
          args,
        }),
      });
    }
  }

  let totalFailed = 0;

  for (const modelId of models) {
    console.log("\n" + "═".repeat(50));
    console.log(`🤖 Running benchmark for model: ${modelId}`);
    console.log("═".repeat(50));

    const pricingLookup = pricing.enabled
      ? (pricing.lookups.get(modelId) ?? null)
      : null;

    if (pricingLookup) {
      const display = getModelPricingDisplay(pricingLookup.pricing);
      console.log(
        `💰 Pricing: ${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out`,
      );
    }

    const model = gateway.languageModel(modelId);

    const testResults = [];
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

    console.log("\n" + "═".repeat(50));
    console.log("📊 Test Summary");
    console.log("═".repeat(50));

    const passed = testResults.filter((r) => r.verification?.passed).length;
    const failed = testResults.filter(
      (r) => r.verification && !r.verification.passed,
    ).length;
    totalFailed += failed;
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

    let totalCost = null;
    let pricingInfo = null;

    if (pricingLookup) {
      totalCost = calculateTotalCost(testResults, pricingLookup.pricing);
      const pricingDisplay = getModelPricingDisplay(pricingLookup.pricing);
      pricingInfo = {
        inputCostPerMTok: pricingDisplay.inputCostPerMTok,
        outputCostPerMTok: pricingDisplay.outputCostPerMTok,
        cacheReadCostPerMTok: pricingDisplay.cacheReadCostPerMTok,
      };

      console.log("\n💰 Cost Summary");
      console.log("─".repeat(50));
      console.log(
        `Input tokens: ${totalCost.inputTokens.toLocaleString()} (${formatCost(totalCost.inputCost)})`,
      );
      console.log(
        `Output tokens: ${totalCost.outputTokens.toLocaleString()} (${formatCost(totalCost.outputCost)})`,
      );
      if (totalCost.cachedInputTokens > 0) {
        console.log(
          `Cached tokens: ${totalCost.cachedInputTokens.toLocaleString()} (${formatCost(totalCost.cacheReadCost)})`,
        );
      }
      console.log(`Total cost: ${formatCost(totalCost.totalCost)}`);
    }

    const resultsDir = "results";
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    const jsonFilename = getTimestampedFilename("result", "json", modelId);
    const htmlFilename = getTimestampedFilename("result", "html", modelId);
    const jsonPath = `${resultsDir}/${jsonFilename}`;
    const htmlPath = `${resultsDir}/${htmlFilename}`;

    const resultData = {
      tests: testResults,
      metadata: {
        mcpEnabled,
        mcpServerUrl: mcpEnabled ? mcpServerUrl! : null,
        mcpTransportType: mcpEnabled ? mcpTransportType : null,
        timestamp: new Date().toISOString(),
        model: modelId,
        pricingKey: pricingLookup?.matchedKey ?? null,
        pricing: pricingInfo,
        totalCost,
      },
    };

    writeFileSync(jsonPath, JSON.stringify(resultData, null, 2));
    console.log(`\n✓ Results saved to ${jsonPath}`);

    await generateReport(jsonPath, htmlPath);
  }

  cleanupOutputsDirectory();

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
