import { Experimental_Agent as Agent, hasToolCall, stepCountIs } from "ai";
import { experimental_createMCPClient as createMCPClient } from "./node_modules/@ai-sdk/mcp/dist/index.mjs";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "./node_modules/@ai-sdk/mcp/dist/mcp-stdio/index.mjs";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
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
} from "./lib/utils.ts";
import { discoverTests, type TestDefinition } from "./lib/test-discovery.ts";
import {
  setupOutputsDirectory,
  cleanupOutputsDirectory,
  cleanupTestEnvironment,
  runTestVerification,
} from "./lib/output-test-runner.ts";
import { resultWriteTool, testComponentTool } from "./lib/tools/index.ts";
import {
  getModelPricingDisplay,
  formatCost,
  formatMTokCost,
  buildPricingMap,
  lookupPricingFromMap,
  formatFullPricingDisplay,
} from "./lib/pricing.ts";
import {
  gateway,
  getGatewayModelsAndPricing,
  selectModelsFromGateway,
  type PricingMap,
  type PricingLookup,
  type PricingResult,
} from "./lib/providers/ai-gateway.ts";
import {
  configureLMStudio,
  selectModelsFromLMStudio,
  getLMStudioModel,
  isLMStudioModel,
  type LMStudioConfig,
} from "./lib/providers/lmstudio.ts";
import type { LanguageModel } from "ai";
import { intro, isCancel, cancel, select, confirm, text, multiselect, note } from "@clack/prompts";

type ProviderType = "gateway" | "lmstudio";

const SETTINGS_FILE = ".ai-settings.json";

interface SavedSettings {
  models: string[];
  mcpIntegration: "none" | "http" | "stdio";
  mcpServerUrl?: string;
  testingTool: boolean;
  pricingEnabled: boolean;
  provider?: ProviderType;
}

function loadSettings(): SavedSettings | null {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const content = readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(content) as SavedSettings;
    }
  } catch {
    console.warn("Could not load saved settings, using defaults");
  }
  return null;
}

function saveSettings(settings: SavedSettings): void {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch {
    console.warn("Could not save settings");
  }
}

interface ProviderConfig {
  type: ProviderType;
  lmstudio?: LMStudioConfig;
}

async function selectProvider(savedProvider?: ProviderType): Promise<ProviderConfig> {
  const provider = await select({
    message: "Select model provider",
    options: [
      {
        value: "gateway",
        label: "Vercel AI Gateway",
        hint: "Cloud-hosted models via Vercel",
      },
      {
        value: "lmstudio",
        label: "LM Studio",
        hint: "Local models via LM Studio",
      },
    ],
    initialValue: savedProvider ?? "gateway",
  });

  if (isCancel(provider)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  if (provider === "lmstudio") {
    const lmstudioConfig = await configureLMStudio();
    return { type: "lmstudio", lmstudio: lmstudioConfig };
  }

  return { type: "gateway" };
}

async function selectOptions() {
  intro("🚀 Svelte AI Bench");

  const savedSettings = loadSettings();
  if (savedSettings) {
    note("Loaded previous settings as defaults", "Saved Settings");
  }

  const providerConfig = await selectProvider(savedSettings?.provider);

  let pricingMap: PricingMap;
  let selectedModels: string[];
  let pricing: PricingResult;

  if (providerConfig.type === "gateway") {
    const gatewayData = await getGatewayModelsAndPricing();
    pricingMap = gatewayData.pricingMap;
    const result = await selectModelsFromGateway(pricingMap);
    selectedModels = result.selectedModels;
    pricing = result.pricing;
  } else {
    pricingMap = buildPricingMap([]);
    selectedModels = await selectModelsFromLMStudio(
      providerConfig.lmstudio!.baseURL,
    );
    pricing = {
      enabled: false,
      lookups: new Map<string, PricingLookup>(),
    };
  }

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

  const newSettings: SavedSettings = {
    models: selectedModels,
    mcpIntegration: mcpIntegrationType,
    mcpServerUrl: mcp,
    testingTool,
    pricingEnabled: pricing.enabled,
  };
  saveSettings(newSettings);

  return {
    models: selectedModels,
    mcp,
    testingTool,
    pricing,
    providerConfig,
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

function getModelForId(
  modelId: string,
  providerConfig: ProviderConfig,
): LanguageModel {
  if (isLMStudioModel(modelId)) {
    return getLMStudioModel(modelId, providerConfig.lmstudio?.baseURL);
  }

  return gateway.languageModel(modelId);
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

  const messages = buildAgentPrompt(test);

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

    const result = await withRetry(
      async () => agent.generate({ messages }),
      {
        retries: 10,
        minTimeout: 1000,
        factor: 2,
      },
    );

    const resultWriteContent = extractResultWriteContent(result.steps);

    if (!resultWriteContent) {
      console.log("  ⚠️  No ResultWrite output found");
      const promptContent = messages[0]?.content;
      const promptStr = promptContent
        ? (typeof promptContent === "string"
          ? promptContent
          : promptContent.toString())
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

    console.log("  ✓ Component generated");

    console.log("  ⏳ Verifying against tests...");
    const verification = await runTestVerification(test, resultWriteContent);

    if (verification.validation) {
      if (verification.validation.valid) {
        console.log("  ✓ Code validation passed");
      } else {
        console.log("  ✗ Code validation failed:");
        for (const error of verification.validation.errors) {
          console.log(`    - ${error}`);
        }
      }
    }

    if (verification.validationFailed) {
      console.log(
        `  ⊘ Validation failed (${verification.numPassed}/${verification.numTests} tests passed)`,
      );
    } else if (verification.passed) {
      console.log(
        `  ✓ All tests passed (${verification.numPassed}/${verification.numTests})`,
      );
    } else {
      console.log(
        `  ✗ Tests failed (${verification.numFailed}/${verification.numTests} failed)`,
      );
      if (verification.failedTests) {
        for (const ft of verification.failedTests) {
          console.log(`    - ${ft.fullName}`);
        }
      }
    }

    cleanupTestEnvironment(test.name);

    const promptContent = messages[0]?.content;
    if (!promptContent) {
      throw new Error("Failed to extract prompt content from messages");
    }
    const promptStr = typeof promptContent === "string"
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
    console.error(`  ✗ Error running test: ${error}`);
    const promptContent = messages[0]?.content;
    const promptStr = promptContent
      ? (typeof promptContent === "string"
        ? promptContent
        : promptContent.toString())
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
  const { models, mcp, testingTool, pricing, providerConfig } =
    await selectOptions();

  const mcpServerUrl = mcp;
  const mcpEnabled = !!mcp;

  const testComponentEnabled = testingTool;

  const isHttpTransport = mcpServerUrl && isHttpUrl(mcpServerUrl);
  const mcpTransportType = isHttpTransport ? "HTTP" : "StdIO";

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║            SvelteBench 2.0 - Multi-Test            ║");
  console.log("╚════════════════════════════════════════════════════╝");

  console.log(
    `\n🔌 Provider: ${providerConfig.type === "gateway" ? "Vercel AI Gateway" : "LM Studio"}`,
  );
  if (providerConfig.type === "lmstudio" && providerConfig.lmstudio) {
    console.log(`   URL: ${providerConfig.lmstudio.baseURL}`);
  }

  console.log("\n📋 Models:");
  for (const modelId of models) {
    const lookup = pricing.lookups.get(modelId);
    if (pricing.enabled && lookup) {
      const display = getModelPricingDisplay(lookup.pricing);
      console.log(`   ${modelId}`);
      console.log(`      💰 ${formatFullPricingDisplay(display)}`);
    } else {
      console.log(`   ${modelId}`);
      if (isLMStudioModel(modelId)) {
        console.log(`      🖥️  Local model (free)`);
      }
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
      console.log(`💰 Pricing: ${formatFullPricingDisplay(display)}`);
    }

    const model = getModelForId(modelId, providerConfig);

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
        provider: providerConfig.type,
        pricingKey: pricingLookup?.matchedKey ?? null,
        pricing: pricingInfo,
        totalCost,
        cacheSimulation,
        lmstudio:
          providerConfig.type === "lmstudio" && providerConfig.lmstudio
            ? {
                baseURL: providerConfig.lmstudio.baseURL,
              }
            : null,
        unitTestTotals,
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
