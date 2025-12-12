export interface ModelPricing {
  inputCostPerToken: number;
  outputCostPerToken: number;
  cacheReadInputTokenCost?: number;
  cacheCreationInputTokenCost?: number;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface ModelPricingDisplay {
  inputCostPerMTok: number;
  outputCostPerMTok: number;
  cacheReadCostPerMTok?: number;
}

export interface ModelPricingLookup {
  pricing: ModelPricing;
  matchedKey: string;
}

export interface GatewayPricing {
  input?: string;
  output?: string;
  cachedInputTokens?: string;
  cacheCreationInputTokens?: string;
}

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

export function extractPricingFromGatewayModel(
  model: GatewayModel,
) {
  if (!model.pricing) {
    return null;
  }

  const { pricing } = model;

  const inputCost = pricing.input ? parseFloat(pricing.input) : NaN;
  const outputCost = pricing.output ? parseFloat(pricing.output) : NaN;

  if (isNaN(inputCost) || isNaN(outputCost)) {
    throw new Error(
      `Invalid pricing for model ${model.id}: input and output pricing must be valid numbers.`,
    );
  }

  const result: ModelPricing = {
    inputCostPerToken: inputCost,
    outputCostPerToken: outputCost,
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

export function buildPricingMap(
  models: GatewayModel[],
) {
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

export function lookupPricingFromMap(
  modelId: string,
  pricingMap: Map<string, ModelPricingLookup | null>,
) {
  return pricingMap.get(modelId) ?? null;
}

export function getModelPricingDisplay(
  pricing: ModelPricing,
) {
  return {
    inputCostPerMTok: pricing.inputCostPerToken * 1_000_000,
    outputCostPerMTok: pricing.outputCostPerToken * 1_000_000,
    cacheReadCostPerMTok:
      pricing.cacheReadInputTokenCost !== undefined
        ? pricing.cacheReadInputTokenCost * 1_000_000
        : undefined,
  };
}

export function calculateCost(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0,
) {
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

export function formatCost(cost: number) {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function formatMTokCost(costPerMTok: number) {
  if (costPerMTok === 0) return "$0";
  if (costPerMTok < 0.01) {
    return `$${costPerMTok.toFixed(4)}`;
  }
  return `$${costPerMTok.toFixed(2)}`;
}
