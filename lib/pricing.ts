import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PRICING_FILE_PATH = join(process.cwd(), "data/model-pricing.json");

/**
 * Model pricing information
 */
export interface ModelPricing {
  inputCostPerToken: number;
  outputCostPerToken: number;
  cacheReadInputTokenCost?: number;
  cacheCreationInputTokenCost?: number;
}

/**
 * Cost calculation result
 */
export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

/**
 * Model pricing data with per-million-token rates for display
 */
export interface ModelPricingDisplay {
  inputCostPerMTok: number;
  outputCostPerMTok: number;
  cacheReadCostPerMTok?: number;
}

/**
 * Result of looking up a model's pricing
 */
export interface ModelPricingLookup {
  pricing: ModelPricing;
  matchedKey: string;
}

// Cache the loaded pricing data
let pricingData: Record<string, unknown> | null = null;

/**
 * Load the pricing data from the JSON file
 */
function loadPricingData(): Record<string, unknown> {
  if (pricingData) {
    return pricingData;
  }

  if (!existsSync(PRICING_FILE_PATH)) {
    console.warn(
      `⚠️ Model pricing file not found at ${PRICING_FILE_PATH}. Run 'bun run update-model-pricing' to download it.`,
    );
    return {};
  }

  try {
    const content = readFileSync(PRICING_FILE_PATH, "utf-8");
    pricingData = JSON.parse(content);
    return pricingData ?? {};
  } catch (error) {
    console.warn(`⚠️ Failed to load model pricing:`, error);
    return {};
  }
}

/**
 * Normalize a model string for pricing lookup
 * Handles various formats like:
 * - anthropic/claude-sonnet-4 -> claude-sonnet-4
 * - openrouter/anthropic/claude-sonnet-4 -> anthropic/claude-sonnet-4
 * - openai/gpt-4o -> gpt-4o
 */
function normalizeModelForLookup(modelString: string): string[] {
  const candidates: string[] = [];

  // Add the original model string (without our provider prefix)
  if (modelString.startsWith("openrouter/")) {
    // openrouter/anthropic/claude-sonnet-4 -> anthropic/claude-sonnet-4
    const withoutOpenRouter = modelString.replace("openrouter/", "");
    candidates.push(`openrouter/${withoutOpenRouter}`);
    candidates.push(withoutOpenRouter);

    // Also try just the model name: anthropic/claude-sonnet-4 -> claude-sonnet-4
    const parts = withoutOpenRouter.split("/");
    if (parts.length > 1) {
      candidates.push(parts.slice(1).join("/"));
    }
  } else if (modelString.startsWith("anthropic/")) {
    // anthropic/claude-sonnet-4 -> claude-sonnet-4
    const modelName = modelString.replace("anthropic/", "");
    candidates.push(modelString);
    candidates.push(modelName);
    // Try common Anthropic naming patterns
    candidates.push(`anthropic/${modelName}`);
  } else if (modelString.startsWith("openai/")) {
    // openai/gpt-4o -> gpt-4o
    const modelName = modelString.replace("openai/", "");
    candidates.push(modelString);
    candidates.push(modelName);
  } else if (modelString.startsWith("lmstudio/")) {
    // Local models - won't have pricing
    candidates.push(modelString);
  } else {
    candidates.push(modelString);
  }

  return candidates;
}

/**
 * Look up pricing information for a model, returning both the pricing and the matched key
 * Returns null if pricing is not found
 */
export function lookupModelPricing(modelString: string): ModelPricingLookup | null {
  const data = loadPricingData();
  const candidates = normalizeModelForLookup(modelString);

  for (const candidate of candidates) {
    const modelData = data[candidate] as Record<string, unknown> | undefined;
    if (modelData) {
      const inputCost = modelData.input_cost_per_token;
      const outputCost = modelData.output_cost_per_token;

      if (typeof inputCost === "number" || typeof outputCost === "number") {
        return {
          pricing: {
            inputCostPerToken: typeof inputCost === "number" ? inputCost : 0,
            outputCostPerToken: typeof outputCost === "number" ? outputCost : 0,
            cacheReadInputTokenCost:
              typeof modelData.cache_read_input_token_cost === "number"
                ? modelData.cache_read_input_token_cost
                : undefined,
            cacheCreationInputTokenCost:
              typeof modelData.cache_creation_input_token_cost === "number"
                ? modelData.cache_creation_input_token_cost
                : undefined,
          },
          matchedKey: candidate,
        };
      }
    }
  }

  return null;
}

/**
 * Get pricing information for a model using an explicit key
 * Returns null if pricing is not found
 */
export function lookupModelPricingByKey(pricingKey: string): ModelPricingLookup | null {
  const data = loadPricingData();
  const modelData = data[pricingKey] as Record<string, unknown> | undefined;

  if (!modelData) {
    return null;
  }

  const inputCost = modelData.input_cost_per_token;
  const outputCost = modelData.output_cost_per_token;

  if (typeof inputCost === "number" || typeof outputCost === "number") {
    return {
      pricing: {
        inputCostPerToken: typeof inputCost === "number" ? inputCost : 0,
        outputCostPerToken: typeof outputCost === "number" ? outputCost : 0,
        cacheReadInputTokenCost:
          typeof modelData.cache_read_input_token_cost === "number"
            ? modelData.cache_read_input_token_cost
            : undefined,
        cacheCreationInputTokenCost:
          typeof modelData.cache_creation_input_token_cost === "number"
            ? modelData.cache_creation_input_token_cost
            : undefined,
      },
      matchedKey: pricingKey,
    };
  }

  return null;
}

/**
 * Get pricing information for a model (legacy function for compatibility)
 * Returns null if pricing is not found
 */
export function getModelPricing(modelString: string): ModelPricing | null {
  const lookup = lookupModelPricing(modelString);
  return lookup?.pricing ?? null;
}

/**
 * Get pricing display information (cost per million tokens)
 */
export function getModelPricingDisplay(
  pricing: ModelPricing,
): ModelPricingDisplay {
  return {
    inputCostPerMTok: pricing.inputCostPerToken * 1_000_000,
    outputCostPerMTok: pricing.outputCostPerToken * 1_000_000,
    cacheReadCostPerMTok: pricing.cacheReadInputTokenCost
      ? pricing.cacheReadInputTokenCost * 1_000_000
      : undefined,
  };
}

/**
 * Calculate the cost for given token usage
 */
export function calculateCost(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0,
): CostCalculation {
  // For cached tokens, we subtract them from input tokens for billing purposes
  // and bill them at the cache read rate (if available, otherwise free)
  const uncachedInputTokens = inputTokens - cachedInputTokens;

  const inputCost = uncachedInputTokens * pricing.inputCostPerToken;
  const outputCost = outputTokens * pricing.outputCostPerToken;
  const cacheReadCost =
    cachedInputTokens * (pricing.cacheReadInputTokenCost ?? 0);

  return {
    inputCost,
    outputCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheReadCost,
    inputTokens,
    outputTokens,
    cachedInputTokens,
  };
}

/**
 * Format a cost value as USD string
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format per-million-token cost
 */
export function formatMTokCost(costPerMTok: number): string {
  if (costPerMTok === 0) return "$0";
  if (costPerMTok < 0.01) {
    return `$${costPerMTok.toFixed(4)}`;
  }
  return `$${costPerMTok.toFixed(2)}`;
}

/**
 * Check if pricing data is available
 */
export function isPricingAvailable(): boolean {
  return existsSync(PRICING_FILE_PATH);
}

/**
 * Get all available model keys (for debugging/listing)
 */
export function getAllModelKeys(): string[] {
  const data = loadPricingData();
  return Object.keys(data).filter((key) => key !== "sample_spec");
}
