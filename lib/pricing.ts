import type { GatewayLanguageModelEntry } from "@ai-sdk/gateway";

export function extractPricingFromGatewayModel(
  model: GatewayLanguageModelEntry,
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

  const result = {
    inputCostPerToken: inputCost,
    outputCostPerToken: outputCost,
  } as {
    inputCostPerToken: number;
    outputCostPerToken: number;
    cacheReadInputTokenCost?: number;
    cacheCreationInputTokenCost?: number;
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

export function buildPricingMap(models: GatewayLanguageModelEntry[]) {
  const map = new Map<
    string,
    {
      pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;
      matchedKey: string;
    } | null
  >();

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
  pricingMap: ReturnType<typeof buildPricingMap>,
) {
  return pricingMap.get(modelId) ?? null;
}

export function getModelPricingDisplay(
  pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>,
) {
  return {
    inputCostPerMTok: pricing.inputCostPerToken * 1_000_000,
    outputCostPerMTok: pricing.outputCostPerToken * 1_000_000,
    cacheReadCostPerMTok:
      pricing.cacheReadInputTokenCost !== undefined
        ? pricing.cacheReadInputTokenCost * 1_000_000
        : undefined,
    cacheCreationCostPerMTok:
      pricing.cacheCreationInputTokenCost !== undefined
        ? pricing.cacheCreationInputTokenCost * 1_000_000
        : undefined,
  };
}

export function calculateCost(
  pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>,
  inputTokens: number,
  outputTokens: number,
) {
  const inputCost = inputTokens * pricing.inputCostPerToken;
  const outputCost = outputTokens * pricing.outputCostPerToken;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputTokens,
    outputTokens,
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
