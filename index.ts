import { Experimental_Agent as Agent, hasToolCall, stepCountIs } from "ai";
import { experimental_createMCPClient as createMCPClient } from "./node_modules/@ai-sdk/mcp/dist/index.mjs";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "./node_modules/@ai-sdk/mcp/dist/mcp-stdio/index.mjs";
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import pLimit from "p-limit";
import {
  generateReport,
  calculateUnitTestTotals,
  type SingleTestResult,
} from "./lib/report.ts";
import {
  getTimestampedFilename,
  isHttpUrl,
  extractResultWriteContent,
  calculateTotalCost,
  withRetry,
  buildAgentPrompt,
  simulateCacheSavings,
  TestLogger,
} from "./lib/utils.ts";
import { discoverTests, type TestDefinition } from "./lib/test-discovery.ts";
import {
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
  formatFullPricingDisplay,
} from "./lib/pricing.ts";
import type { LanguageModel } from "ai";
import {
  intro,
  autocompleteMultiselect,
  isCancel,
  cancel,
  text,
  select,
  confirm,
  note,
} from "@clack/prompts";
import { gateway } from "ai";

const SETTINGS_FILE = ".ai-settings.json";

interface SavedSettings {
  models: string[];
  mcpIntegration: "none" | "http" | "stdio";
  mcpServerUrl?: string;
  testingTool: boolean;
  pricingEnabled: boolean;
  concurrencyLimit?: number;
}

function loadSettings(): SavedSettings | null {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(content) as SavedSettings;
    }
  } catch (error) {
    console.warn("⚠️  Could not load saved settings, using defaults");
  }
  return null;
}

function saveSettings(settings: SavedSettings): void {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.warn("⚠️  Could not save settings");
  }
}

async function validateAndConfirmPricing(
  models: string[],
  pricingMap: ReturnType<typeof buildPricingMap>,
  savedPricingEnabled?: boolean,
) {
  const lookups = new Map<string, ReturnType<typeof lookupPricingFromMap>>();

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
      return `${modelId}\n  → ${formatFullPricingDisplay(display)}`;
    });

    note(pricingLines.join("\n\n"), "💰 Pricing Found");

    const usePricing = await confirm({
      message: "Enable cost calculation?",
      initialValue: savedPricingEnabled ?? true,
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
        lines.push(`  ✓ ${modelId} (${formatFullPricingDisplay(display)})`);
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

  const savedSettings = loadSettings();
  if (savedSettings) {
    note("Loaded previous settings as defaults", "📋 Saved Settings");
  }

  const availableModels = await gateway.getAvailableModels();

  const pricingMap = buildPricingMap(availableModels.models);

  const modelOptions = [{ value: "custom", label: "Custom" }].concat(
    availableModels.models.reduce<Array<{ value: string; label: string }>>(
      (arr, model) => {
        if (model.modelType === "language") {
          arr.push({ value: model.id, label: model.name });
        }
        return arr;
      },
      [],
    ),
  );

  const savedModelValues = savedSettings?.models ?? [];

  const models = await autocompleteMultiselect({
    message: "Select model(s) to benchmark",
    options: modelOptions,
    initialValues: savedModelValues.filter((m) =>
      modelOptions.some((opt) => opt.value === m),
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

  const pricing = await validateAndConfirmPricing(
    selectedModels,
    pricingMap,
    savedSettings?.pricingEnabled,
  );

  const savedMcpIntegration = savedSettings?.mcpIntegration ?? "none";

  const mcpIntegration = await select({
    message: "Which MCP integration to use?",
    options: [
      { value: "none", label: "No MCP Integration" },
      { value: "http", label: "MCP over HTTP" },
      { value: "stdio", label: "MCP over StdIO" },
    ],
    initialValue: savedMcpIntegration,
  });

  if (isCancel(mcpIntegration)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  let mcp: string | undefined = undefined;
  let mcpIntegrationType: "none" | "http" | "stdio" = "none";

  if (mcpIntegration !== "none") {
    mcpIntegrationType = mcpIntegration as "http" | "stdio";

    const savedMcpUrl = savedSettings?.mcpServerUrl;
    const defaultMcpUrl =
      mcpIntegration === "http"
        ? "https://mcp.svelte.dev/mcp"
        : "npx -y @sveltejs/mcp";

    const hasSavedCustomUrl =
      !!savedMcpUrl &&
      savedSettings?.mcpIntegration === mcpIntegration &&
      savedMcpUrl !== defaultMcpUrl;

    const custom = await confirm({
      message: "Do you want to provide a custom MCP server/command?",
      initialValue: hasSavedCustomUrl ?? false,
    });

    if (isCancel(custom)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    if (custom) {
      const customMcp = await text({
        message: "Insert custom url or command",
        initialValue: hasSavedCustomUrl ? savedMcpUrl : undefined,
      });
      if (isCancel(customMcp)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      mcp = customMcp;
    } else {
      mcp = defaultMcpUrl;
    }
  }

  const testingTool = await confirm({
    message: "Do you want to provide the testing tool to the model?",
    initialValue: savedSettings?.testingTool ?? true,
  });

  if (isCancel(testingTool)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const concurrencyLimitInput = await text({
    message: "Max concurrent tests? (0 = unlimited)",
    initialValue: savedSettings?.concurrencyLimit?.toString() ?? "0",
    validate: (value) => {
      const num = parseInt(value ?? "0", 10);
      if (isNaN(num) || num < 0) {
        return "Please enter a non-negative number";
      }
    },
  });

  if (isCancel(concurrencyLimitInput)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const concurrencyLimit = parseInt(concurrencyLimitInput || "0", 10);

  const newSettings: SavedSettings = {
    models: selectedModels,
    mcpIntegration: mcpIntegrationType,
    mcpServerUrl: mcp,
    testingTool,
    pricingEnabled: pricing.enabled,
    concurrencyLimit,
  };
  saveSettings(newSettings);

  return {
    models: selectedModels,
    mcp,
    testingTool,
    pricing,
    concurrencyLimit,
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
  outputDir: string,
): Promise<SingleTestResult> {
  const logger = new TestLogger(test.name);
  logger.log(`[${testIndex + 1}/${totalTests}] Running test: ${test.name}`);

  const messages = buildAgentPrompt(test);

  try {
    const tools = {
      ResultWrite: resultWriteTool,
      ...(testComponentEnabled && {
        TestComponent: testComponentTool(test, outputDir),
      }),
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
        logger.log(`  Step ${stepCounter}:`);
        if (step.text) {
          const preview =
            step.text.length > 100
              ? step.text.slice(0, 100) + "..."
              : step.text;
          logger.log(`💬 Text: ${preview}`);
        }
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const call of step.toolCalls) {
            if (call) {
              logger.log(`🔧 Tool call: ${call.toolName}`);
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
              logger.log(`📤 Tool result: ${preview}`);
            }
          }
        }
      },
    });

    logger.log("  ⏳ Running agent...");
    if (testComponentEnabled) {
      logger.log("  📋 TestComponent tool is available");
    }

    const result = await withRetry(async () => agent.generate({ messages }), {
      retries: 10,
      minTimeout: 1000,
      factor: 2,
    });

    const resultWriteContent = extractResultWriteContent(result.steps);

    if (!resultWriteContent) {
      logger.log("  ⚠️  No ResultWrite output found");
      logger.flush();
      const promptContent = messages[0]?.content;
      const promptStr = promptContent
        ? typeof promptContent === "string"
          ? promptContent
          : promptContent.toString()
        : "";

      return {
        testName: test.name,
        prompt: promptStr,
        steps: result.steps as unknown as SingleTestResult["steps"],
        resultWriteContent: null,
        verification: {
          testName: test.name,
          passed: false,
          numTests: 0,
          numPassed: 0,
          numFailed: 0,
          duration: 0,
          error: "Agent did not produce output (no ResultWrite tool call)",
        },
      };
    }

    logger.log("  ✓ Component generated");

    logger.log("  ⏳ Verifying against tests...");
    const verification = await runTestVerification(
      test,
      resultWriteContent,
      outputDir,
    );

    if (verification.validation) {
      if (verification.validation.valid) {
        logger.log("  ✓ Code validation passed");
      } else {
        logger.log("  ✗ Code validation failed:");
        for (const error of verification.validation.errors) {
          logger.log(`    - ${error}`);
        }
      }
    }

    if (verification.validationFailed) {
      logger.log(
        `  ⊘ Validation failed (${verification.numPassed}/${verification.numTests} tests passed)`,
      );
    } else if (verification.passed) {
      logger.log(
        `  ✓ All tests passed (${verification.numPassed}/${verification.numTests})`,
      );
    } else {
      logger.log(
        `  ✗ Tests failed (${verification.numFailed}/${verification.numTests} failed)`,
      );
      if (verification.failedTests) {
        for (const ft of verification.failedTests) {
          logger.log(`    - ${ft.fullName}`);
        }
      }
    }

    cleanupTestEnvironment(test.name, outputDir);

    logger.flush();

    const promptContent = messages[0]?.content;
    if (!promptContent) {
      throw new Error("Failed to extract prompt content from messages");
    }
    const promptStr =
      typeof promptContent === "string"
        ? promptContent
        : promptContent.toString();

    return {
      testName: test.name,
      prompt: promptStr,
      steps: result.steps as unknown as SingleTestResult["steps"],
      resultWriteContent,
      verification,
    };
  } catch (error) {
    logger.log(`  ✗ Error running test: ${error}`);
    logger.flush();
    const promptContent = messages[0]?.content;
    const promptStr = promptContent
      ? typeof promptContent === "string"
        ? promptContent
        : promptContent.toString()
      : "Failed: Unable to extract prompt content";
    return {
      testName: test.name,
      prompt: promptStr,
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
  const { models, mcp, testingTool, pricing, concurrencyLimit } =
    await selectOptions();

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
      console.log(`      💰 ${formatFullPricingDisplay(display)}`);
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

  console.log(
    `⚡ Concurrency: ${concurrencyLimit === 0 ? "Unlimited" : concurrencyLimit}`,
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

  // Create base outputs directory (individual tests will use unique subdirectories)
  const baseOutputsDir = join(process.cwd(), "outputs");
  if (!existsSync(baseOutputsDir)) {
    mkdirSync(baseOutputsDir, { recursive: true });
  }

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

  // Set up concurrency limiter
  const limit = pLimit(concurrencyLimit === 0 ? Infinity : concurrencyLimit);

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
      console.log(`💰 Pricing: ${formatFullPricingDisplay(display)}`);
    }

    const model = gateway.languageModel(modelId);

    const startTime = Date.now();

    // Run tests in parallel with unique output directories
    const testPromises = tests.map((test, i) =>
      limit(async () => {
        const uniqueOutputDir = join(baseOutputsDir, randomUUID());
        mkdirSync(uniqueOutputDir, { recursive: true });

        try {
          return await runSingleTest(
            test,
            model,
            mcpClient,
            testComponentEnabled,
            i,
            tests.length,
            uniqueOutputDir,
          );
        } finally {
          // Clean up the unique directory after test completes
          if (existsSync(uniqueOutputDir)) {
            rmSync(uniqueOutputDir, { recursive: true, force: true });
          }
        }
      }),
    );

    const testResults = await Promise.all(testPromises);

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

    const unitTestTotals = calculateUnitTestTotals(testResults);

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

      const validationInfo = result.verification?.validation
        ? result.verification.validation.valid
          ? " (validated)"
          : " (validation failed)"
        : "";

      const unitTestInfo = result.verification
        ? ` [${result.verification.numPassed}/${result.verification.numTests} unit tests]`
        : "";

      console.log(
        `${status} ${result.testName}: ${statusText}${validationInfo}${unitTestInfo}`,
      );
    }

    console.log("─".repeat(50));
    console.log(
      `Test Suites: ✓ ${passed} passed  ✗ ${failed} failed  ${skipped > 0 ? `⊘ ${skipped} skipped  ` : ""}(${unitTestTotals.passed}/${unitTestTotals.total} unit tests)`,
    );
    console.log(`Score:       ${unitTestTotals.score}%`);
    console.log(`Duration:    ${(totalDuration / 1000).toFixed(1)}s`);

    let totalCost = null;
    let pricingInfo = null;
    let cacheSimulation = null;

    if (pricingLookup) {
      totalCost = calculateTotalCost(testResults, pricingLookup.pricing);
      const pricingDisplay = getModelPricingDisplay(pricingLookup.pricing);
      pricingInfo = {
        inputCostPerMTok: pricingDisplay.inputCostPerMTok,
        outputCostPerMTok: pricingDisplay.outputCostPerMTok,
        cacheReadCostPerMTok: pricingDisplay.cacheReadCostPerMTok,
        cacheCreationCostPerMTok: pricingDisplay.cacheCreationCostPerMTok,
      };

      console.log("\n💵 Cost Summary (No Caching)");
      console.log("─".repeat(50));
      console.log(
        `Input tokens: ${totalCost.inputTokens.toLocaleString()} (${formatCost(totalCost.inputCost)})`,
      );
      console.log(
        `Output tokens: ${totalCost.outputTokens.toLocaleString()} (${formatCost(totalCost.outputCost)})`,
      );
      console.log(`Total cost: ${formatCost(totalCost.totalCost)}`);

      // Simulate cache savings if cache pricing is available
      if (
        pricingLookup.pricing.cacheReadInputTokenCost !== undefined &&
        pricingLookup.pricing.cacheCreationInputTokenCost !== undefined
      ) {
        cacheSimulation = simulateCacheSavings(
          testResults,
          pricingLookup.pricing,
        );

        if (
          cacheSimulation.cacheHits > 0 ||
          cacheSimulation.cacheWriteTokens > 0
        ) {
          console.log("\n📊 Simulated Cost (With Caching)");
          console.log("─".repeat(50));
          console.log(
            `Cache reads: ${cacheSimulation.cacheHits.toLocaleString()} tokens`,
          );
          console.log(
            `Cache writes: ${cacheSimulation.cacheWriteTokens.toLocaleString()} tokens`,
          );
          console.log(
            `Output tokens: ${cacheSimulation.outputTokens.toLocaleString()}`,
          );
          console.log(
            `Simulated total: ${formatCost(cacheSimulation.simulatedCostWithCache)}`,
          );

          const savings =
            totalCost.totalCost - cacheSimulation.simulatedCostWithCache;
          const savingsPercent = (savings / totalCost.totalCost) * 100;
          if (savings > 0) {
            console.log(
              `Potential savings: ${formatCost(savings)} (${savingsPercent.toFixed(1)}%)`,
            );
          }
        }
      }
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
        cacheSimulation,
        unitTestTotals,
      },
    };

    writeFileSync(jsonPath, JSON.stringify(resultData, null, 2));
    console.log(`\n✓ Results saved to ${jsonPath}`);

    await generateReport(jsonPath, htmlPath);
  }

  // Clean up the base outputs directory
  cleanupOutputsDirectory(baseOutputsDir);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
