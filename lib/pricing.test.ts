import { describe, it, expect } from "vitest";
import {
  extractPricingFromGatewayModel,
  buildPricingMap,
  lookupPricingFromMap,
  calculateCost,
  formatCost,
  formatMTokCost,
  getModelPricingDisplay,
} from "./pricing.ts";
import type { GatewayLanguageModelEntry } from "@ai-sdk/gateway";

describe("extractPricingFromGatewayModel", () => {
  it("should extract pricing from a gateway model with all fields", () => {
    const model: GatewayLanguageModelEntry = {
      id: "anthropic/claude-opus-4.5",
      name: "Claude Opus 4.5",
      pricing: {
        input: "0.000005",
        output: "0.000025",
        cachedInputTokens: "0.0000005",
        cacheCreationInputTokens: "0.00000625",
      },
      specification: {
        specificationVersion: "v2",
        provider: "anthropic",
        modelId: "claude-opus-4.5",
      },
      modelType: "language",
    };

    const pricing = extractPricingFromGatewayModel(model);

    expect(pricing).not.toBeNull();
    expect(pricing!.inputCostPerToken).toBe(0.000005);
    expect(pricing!.outputCostPerToken).toBe(0.000025);
    expect(pricing!.cacheReadInputTokenCost).toBe(0.0000005);
    expect(pricing!.cacheCreationInputTokenCost).toBe(0.00000625);
  });

  it("should extract pricing with only input and output", () => {
    const model: GatewayLanguageModelEntry = {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      pricing: {
        input: "0.000003",
        output: "0.000015",
      },
      specification: {
        specificationVersion: "v2",
        provider: "openai",
        modelId: "gpt-4o",
      },
      modelType: "language",
    };

    const pricing = extractPricingFromGatewayModel(model);

    expect(pricing).not.toBeNull();
    expect(pricing!.inputCostPerToken).toBe(0.000003);
    expect(pricing!.outputCostPerToken).toBe(0.000015);
    expect(pricing!.cacheReadInputTokenCost).toBeUndefined();
    expect(pricing!.cacheCreationInputTokenCost).toBeUndefined();
  });

  it("should return null for model without pricing", () => {
    const model: GatewayLanguageModelEntry = {
      id: "local/model",
      name: "Local Model",
      specification: {
        specificationVersion: "v2",
        provider: "local",
        modelId: "model",
      },
      modelType: "language",
    };

    const pricing = extractPricingFromGatewayModel(model);
    expect(pricing).toBeNull();
  });

  it("should throw error for model with empty pricing object", () => {
    const model = {
      id: "local/model",
      name: "Local Model",
      pricing: {} as any,
      specification: {
        specificationVersion: "v2",
        provider: "local",
        modelId: "model",
      },
      modelType: "language",
    } as GatewayLanguageModelEntry;

    expect(() => extractPricingFromGatewayModel(model)).toThrowError(
      /Invalid pricing/,
    );
  });

  it("should throw error for invalid pricing values", () => {
    const model: GatewayLanguageModelEntry = {
      id: "test/model",
      name: "Test Model",
      pricing: {
        input: "invalid",
        output: "0.000015",
      },
      specification: {
        specificationVersion: "v2",
        provider: "test",
        modelId: "model",
      },
      modelType: "language",
    };

    expect(() => extractPricingFromGatewayModel(model)).toThrowError(
      /Invalid pricing/,
    );
  });
});

describe("buildPricingMap", () => {
  it("should build a map from gateway models", () => {
    const models: GatewayLanguageModelEntry[] = [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        pricing: { input: "0.000003", output: "0.000015" },
        specification: {
          specificationVersion: "v2",
          provider: "anthropic",
          modelId: "claude-sonnet-4",
        },
        modelType: "language",
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        pricing: { input: "0.000005", output: "0.000015" },
        specification: {
          specificationVersion: "v2",
          provider: "openai",
          modelId: "gpt-4o",
        },
        modelType: "language",
      },
      {
        id: "local/model",
        name: "Local Model",
        specification: {
          specificationVersion: "v2",
          provider: "local",
          modelId: "model",
        },
        modelType: "language",
      },
    ];

    const map = buildPricingMap(models);

    expect(map.size).toBe(3);
    expect(map.get("anthropic/claude-sonnet-4")).not.toBeNull();
    expect(map.get("openai/gpt-4o")).not.toBeNull();
    expect(map.get("local/model")).toBeNull();
  });
});

describe("lookupPricingFromMap", () => {
  it("should return pricing lookup for existing model", () => {
    const models: GatewayLanguageModelEntry[] = [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        pricing: { input: "0.000003", output: "0.000015" },
        specification: {
          specificationVersion: "v2",
          provider: "anthropic",
          modelId: "claude-sonnet-4",
        },
        modelType: "language",
      },
    ];

    const map = buildPricingMap(models);
    const lookup = lookupPricingFromMap("anthropic/claude-sonnet-4", map);

    expect(lookup).not.toBeNull();
    expect(lookup!.matchedKey).toBe("anthropic/claude-sonnet-4");
    expect(lookup!.pricing.inputCostPerToken).toBe(0.000003);
  });

  it("should return null for non-existent model", () => {
    const map = buildPricingMap([]);
    const lookup = lookupPricingFromMap("non/existent", map);
    expect(lookup).toBeNull();
  });
});

describe("calculateCost", () => {
  const basePricing = {
    inputCostPerToken: 0.000003, // $3 per MTok
    outputCostPerToken: 0.000015, // $15 per MTok
  } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

  const pricingWithCache = {
    ...basePricing,
    cacheReadInputTokenCost: 0.0000003, // $0.30 per MTok (10% of input)
  } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

  describe("basic cost calculation", () => {
    it("should calculate cost correctly", () => {
      const result = calculateCost(basePricing, 1000, 500);

      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
      expect(result.inputCost).toBe(0.003); // 1000 * $3/MTok
      expect(result.outputCost).toBeCloseTo(0.0075); // 500 * $15/MTok
      expect(result.totalCost).toBe(0.0105);
    });
  });


  describe("edge cases", () => {
    it("should handle zero tokens", () => {
      const result = calculateCost(basePricing, 0, 0);

      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it("should handle large token counts", () => {
      const result = calculateCost(basePricing, 1_000_000, 500_000);

      expect(result.inputCost).toBe(3); // 1M * $3/MTok
      expect(result.outputCost).toBe(7.5); // 500K * $15/MTok
      expect(result.totalCost).toBe(10.5);
    });

    it("should handle pricing with zero costs", () => {
      const freePricing = {
        inputCostPerToken: 0,
        outputCostPerToken: 0,
      } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;
      const result = calculateCost(freePricing, 1000, 500);

      expect(result.totalCost).toBe(0);
    });
  });
});

describe("formatCost", () => {
  it('should format zero as "$0.00"', () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("should format very small costs with 6 decimal places", () => {
    expect(formatCost(0.000123)).toBe("$0.000123");
    expect(formatCost(0.001)).toBe("$0.001000");
    expect(formatCost(0.0099)).toBe("$0.009900");
  });

  it("should format small costs with 4 decimal places", () => {
    expect(formatCost(0.01)).toBe("$0.0100");
    expect(formatCost(0.1234)).toBe("$0.1234");
    expect(formatCost(0.99)).toBe("$0.9900");
  });

  it("should format costs >= $1 with 2 decimal places", () => {
    expect(formatCost(1)).toBe("$1.00");
    expect(formatCost(1.234)).toBe("$1.23");
    expect(formatCost(10.5)).toBe("$10.50");
    expect(formatCost(100)).toBe("$100.00");
  });
});

describe("formatMTokCost", () => {
  it('should format zero as "$0"', () => {
    expect(formatMTokCost(0)).toBe("$0");
  });

  it("should format very small per-MTok costs with 4 decimal places", () => {
    expect(formatMTokCost(0.001)).toBe("$0.0010");
    expect(formatMTokCost(0.0099)).toBe("$0.0099");
  });

  it("should format per-MTok costs >= $0.01 with 2 decimal places", () => {
    expect(formatMTokCost(0.01)).toBe("$0.01");
    expect(formatMTokCost(0.3)).toBe("$0.30");
    expect(formatMTokCost(3)).toBe("$3.00");
    expect(formatMTokCost(15)).toBe("$15.00");
  });
});

describe("getModelPricingDisplay", () => {
  it("should convert per-token costs to per-MTok", () => {
    const pricing = {
      inputCostPerToken: 0.000003, // $3 per MTok
      outputCostPerToken: 0.000015, // $15 per MTok
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(3);
    expect(display.outputCostPerMTok).toBe(15);
    expect(display.cacheReadCostPerMTok).toBeUndefined();
    expect(display.cacheCreationCostPerMTok).toBeUndefined();
  });

  it("should include cache read cost when available", () => {
    const pricing = {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadInputTokenCost: 0.0000003, // $0.30 per MTok
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(3);
    expect(display.outputCostPerMTok).toBe(15);
    expect(display.cacheReadCostPerMTok).toBe(0.3);
    expect(display.cacheCreationCostPerMTok).toBeUndefined();
  });

  it("should include cache creation cost when available", () => {
    const pricing = {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadInputTokenCost: 0.0000003, // $0.30 per MTok
      cacheCreationInputTokenCost: 0.00000375, // $3.75 per MTok
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(3);
    expect(display.outputCostPerMTok).toBe(15);
    expect(display.cacheReadCostPerMTok).toBe(0.3);
    expect(display.cacheCreationCostPerMTok).toBe(3.75);
  });

  it("should handle zero costs", () => {
    const pricing = {
      inputCostPerToken: 0,
      outputCostPerToken: 0,
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(0);
    expect(display.outputCostPerMTok).toBe(0);
  });

  it("should preserve explicit zero cost for cache read", () => {
    const pricing = {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadInputTokenCost: 0,
    } satisfies NonNullable<ReturnType<typeof extractPricingFromGatewayModel>>;

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(3);
    expect(display.outputCostPerMTok).toBe(15);
    expect(display.cacheReadCostPerMTok).toBe(0);
  });
});
