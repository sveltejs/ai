#!/usr/bin/env bun
/**
 * Script to download the latest model pricing data from LiteLLM
 * Run with: bun run update-model-pricing
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const PRICING_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const OUTPUT_PATH = "data/model-pricing.json";

async function downloadPricing(): Promise<void> {
  console.log("📥 Downloading model pricing data from LiteLLM...");
  console.log(`   URL: ${PRICING_URL}`);

  try {
    const response = await fetch(PRICING_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate the data has expected structure
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid JSON: expected an object");
    }

    const modelCount = Object.keys(data).length;
    console.log(`✓ Downloaded pricing for ${modelCount} models`);

    // Ensure the output directory exists
    const dir = dirname(OUTPUT_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write the file with pretty formatting
    writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Saved to ${OUTPUT_PATH}`);

    // Show some stats
    let chatModels = 0;
    let modelsWithPricing = 0;

    for (const [key, value] of Object.entries(data)) {
      if (key === "sample_spec") continue;

      const model = value as Record<string, unknown>;
      if (model.mode === "chat") {
        chatModels++;
      }
      if (
        typeof model.input_cost_per_token === "number" ||
        typeof model.output_cost_per_token === "number"
      ) {
        modelsWithPricing++;
      }
    }

    console.log(`\n📊 Stats:`);
    console.log(`   Chat models: ${chatModels}`);
    console.log(`   Models with token pricing: ${modelsWithPricing}`);
  } catch (error) {
    console.error(
      "✗ Failed to download pricing:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

downloadPricing();
