import { Experimental_Agent as Agent, hasToolCall, stepCountIs } from "ai";
import { experimental_createMCPClient as createMCPClient } from "./node_modules/@ai-sdk/mcp/dist/index.mjs";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "./node_modules/@ai-sdk/mcp/dist/mcp-stdio/index.mjs";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { generateReport, type SingleTestResult } from "./lib/report.ts";
import {
  getTimestampedFilename,
  isHttpUrl,
  extractResultWriteContent,
  calculateTotalCost,
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
import { getModelPricingDisplay, formatCost, formatMTokCost } from "./lib/pricing.ts";
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
import { intro, isCancel, cancel, select, confirm, text } from "@clack/prompts";
import { buildPricingMap } from "./lib/pricing.ts";

type ProviderType = "gateway" | "lmstudio";

interface ProviderConfig {
  type: ProviderType;
  lmstudio?: LMStudioConfig;
}

async function selectProvider(): Promise<ProviderConfig> {
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
    initialValue: "gateway",
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

  const providerConfig = await selectProvider();

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

  const mcp_integration = await select({
    message: "Which MCP integration to use?",
    options: [
      { value: "none", label: "No MCP Integration" },
      { value: "http", label: "MCP over HTTP" },
      { value: "stdio", label: "MCP over StdIO" },
    ],
    initialValue: "http",
  });

  if (isCancel(mcp_integration)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  let mcp: string | undefined = undefined;

  if (mcp_integration !== "none") {
    const custom = await confirm({
      message: "Do you want to provide a custom MCP server/command?",
      initialValue: false,
    });

    if (isCancel(custom)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    if (custom) {
      const custom_mcp = await text({
        message: "Insert custom url or command",
      });
      if (isCancel(custom_mcp)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      mcp = custom_mcp;
    } else {
      mcp =
        mcp_integration === "http"
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
    const result = await agent.generate({ messages });

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
      const cacheReadText =
        display.cacheReadCostPerMTok !== undefined
          ? `, ${formatMTokCost(display.cacheReadCostPerMTok)}/MTok cache read`
          : "";
      const cacheWriteText =
        display.cacheCreationCostPerMTok !== undefined
          ? `, ${formatMTokCost(display.cacheCreationCostPerMTok)}/MTok cache write`
          : "";
      console.log(`   ${modelId}`);
      console.log(
        `      💰 ${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out${cacheReadText}${cacheWriteText}`,
      );
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
      const cacheReadText =
        display.cacheReadCostPerMTok !== undefined
          ? `, ${formatMTokCost(display.cacheReadCostPerMTok)}/MTok cache read`
          : "";
      const cacheWriteText =
        display.cacheCreationCostPerMTok !== undefined
          ? `, ${formatMTokCost(display.cacheCreationCostPerMTok)}/MTok cache write`
          : "";
      console.log(
        `💰 Pricing: ${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out${cacheReadText}${cacheWriteText}`,
      );
    }

    const model = getModelForId(modelId, providerConfig);

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
          `Cached tokens: ${totalCost.cachedInputTokens.toLocaleString()}`,
        );
      }
      console.log(`Total cost: ${formatCost(totalCost.totalCost)}`);

      cacheSimulation = simulateCacheSavings(
        testResults,
        pricingLookup.pricing,
      );
      if (
        cacheSimulation.cacheHits > 0 ||
        cacheSimulation.cacheWriteTokens > 0
      ) {
        console.log("\n📊 Cache Simulation (estimated with prompt caching):");
        console.log("─".repeat(50));
        const totalCacheTokens =
          cacheSimulation.cacheHits + cacheSimulation.cacheWriteTokens;
        console.log(
          `Cache reads: ${cacheSimulation.cacheHits.toLocaleString()} tokens`,
        );
        console.log(
          `Cache writes: ${cacheSimulation.cacheWriteTokens.toLocaleString()} tokens`,
        );
        console.log(
          `Total input tokens: ${totalCacheTokens.toLocaleString()} (reads + writes)`,
        );
        console.log(
          `Estimated cost with cache: ${formatCost(cacheSimulation.simulatedCostWithCache)}`,
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
