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

/**
 * Vercel AI Gateway pricing format from getAvailableModels()
 */
export interface GatewayPricing {
  input?: string;
  output?: string;
  cachedInputTokens?: string;
  cacheCreationInputTokens?: string;
}

/**
 * Vercel AI Gateway model format from getAvailableModels()
 */
export interface GatewayModel {
  id: string;
  name: string;
  description?: string;
  pricing?: GatewayPricing;
  specification?: {
    specificationVersion: string;
    provider: string;
    modelId: string;
  };
  modelType: string;
}

/**
 * Extract ModelPricing from a Vercel AI Gateway model
 * Returns null if no pricing information is available
 */
export function extractPricingFromGatewayModel(
  model: GatewayModel,
): ModelPricing | null {
  if (!model.pricing) {
    return null;
  }

  const { pricing } = model;

  // Parse string values to numbers
  const inputCost = pricing.input ? parseFloat(pricing.input) : 0;
  const outputCost = pricing.output ? parseFloat(pricing.output) : 0;

  // If both are zero or NaN, no valid pricing
  if ((inputCost === 0 || isNaN(inputCost)) && (outputCost === 0 || isNaN(outputCost))) {
    return null;
  }

  const result: ModelPricing = {
    inputCostPerToken: isNaN(inputCost) ? 0 : inputCost,
    outputCostPerToken: isNaN(outputCost) ? 0 : outputCost,
  };

  if (pricing.cachedInputTokens) {
    const cached = parseFloat(pricing.cachedInputTokens);
    if (!isNaN(cached)) {
      result.cacheReadInputTokenCost = cached;
    }
  }

  if (pricing.cacheCreationInputTokens) {
    const creation = parseFloat(pricing.cacheCreationInputTokens);
    if (!isNaN(creation)) {
      result.cacheCreationInputTokenCost = creation;
    }
  }

  return result;
}

/**
 * Build a pricing lookup map from gateway models
 * Returns a map of model ID to pricing lookup result
 */
export function buildPricingMap(
  models: GatewayModel[],
): Map<string, ModelPricingLookup | null> {
  const map = new Map<string, ModelPricingLookup | null>();

  for (const model of models) {
    const pricing = extractPricingFromGatewayModel(model);
    if (pricing) {
      map.set(model.id, {
        pricing,
        matchedKey: model.id,
      });
    } else {
      map.set(model.id, null);
    }
  }

  return map;
}

/**
 * Look up pricing for a specific model ID from pre-built pricing map
 */
export function lookupPricingFromMap(
  modelId: string,
  pricingMap: Map<string, ModelPricingLookup | null>,
): ModelPricingLookup | null {
  return pricingMap.get(modelId) ?? null;
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
    cacheReadCostPerMTok:
      pricing.cacheReadInputTokenCost !== undefined
        ? pricing.cacheReadInputTokenCost * 1_000_000
        : undefined,
  };
}

/**
 * Calculate the cost for given token usage
 *
 * Billing model explanation:
 * - inputTokens: Total input tokens reported by the API (includes cached)
 * - cachedInputTokens: Subset of input tokens that were cache hits
 * - Cached tokens are billed at a reduced rate (cacheReadInputTokenCost)
 * - Uncached input tokens (inputTokens - cachedInputTokens) are billed at full rate
 * - Output tokens are always billed at the output rate
 */
export function calculateCost(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0,
): CostCalculation {
  // Uncached input tokens are billed at full input rate
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const inputCost = uncachedInputTokens * pricing.inputCostPerToken;

  // Output tokens billed at output rate
  const outputCost = outputTokens * pricing.outputCostPerToken;

  // Cached tokens billed at reduced cache read rate (or free if not specified)
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
