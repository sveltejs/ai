import { gateway } from "ai";
import { multiselect, isCancel, cancel, text, confirm, note } from "@clack/prompts";
import {
  buildPricingMap,
  lookupPricingFromMap,
  getModelPricingDisplay,
  formatMTokCost,
} from "../pricing.ts";

export { gateway };

export type PricingMap = ReturnType<typeof buildPricingMap>;
export type PricingLookup = ReturnType<typeof lookupPricingFromMap>;

export interface PricingResult {
  enabled: boolean;
  lookups: Map<string, PricingLookup>;
}

export async function getGatewayModelsAndPricing() {
  const availableModels = await gateway.getAvailableModels();
  const pricingMap = buildPricingMap(availableModels.models);
  return { models: availableModels.models, pricingMap };
}

export async function validateAndConfirmPricing(
  models: string[],
  pricingMap: PricingMap,
  savedPricingEnabled?: boolean,
): Promise<PricingResult> {
  const lookups = new Map<string, PricingLookup>();

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
      const cacheReadText =
        display.cacheReadCostPerMTok !== undefined
          ? `, ${formatMTokCost(display.cacheReadCostPerMTok)}/MTok cache read`
          : "";
      const cacheWriteText =
        display.cacheCreationCostPerMTok !== undefined
          ? `, ${formatMTokCost(display.cacheCreationCostPerMTok)}/MTok cache write`
          : "";
      return `${modelId}\n  → ${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out${cacheReadText}${cacheWriteText}`;
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
        const cacheReadText =
          display.cacheReadCostPerMTok !== undefined
            ? `, ${formatMTokCost(display.cacheReadCostPerMTok)}/MTok cache read`
            : "";
        const cacheWriteText =
          display.cacheCreationCostPerMTok !== undefined
            ? `, ${formatMTokCost(display.cacheCreationCostPerMTok)}/MTok cache write`
            : "";
        lines.push(
          `  ✓ ${modelId} (${formatMTokCost(display.inputCostPerMTok)}/MTok in, ${formatMTokCost(display.outputCostPerMTok)}/MTok out${cacheReadText}${cacheWriteText})`,
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

export async function selectModelsFromGateway(
  pricingMap: PricingMap,
  savedPricingEnabled?: boolean,
) {
  const availableModels = await gateway.getAvailableModels();

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
  const pricing = await validateAndConfirmPricing(selectedModels, pricingMap, savedPricingEnabled);

  return { selectedModels, pricing };
}
