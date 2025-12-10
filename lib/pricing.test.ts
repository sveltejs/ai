import { describe, it, expect } from "vitest";
import {
  _generateLookupCandidates as generateLookupCandidates,
  calculateCost,
  formatCost,
  formatMTokCost,
  getModelPricingDisplay,
  type ModelPricing,
} from "./pricing.ts";

describe("generateLookupCandidates", () => {
  describe("Vercel AI Gateway format (provider/model)", () => {
    it("should generate candidates for alibaba/qwen-3-14b", () => {
      const candidates = generateLookupCandidates("alibaba/qwen-3-14b");
      expect(candidates).toEqual([
        "vercel_ai_gateway/alibaba/qwen-3-14b",
        "alibaba/qwen-3-14b",
        "qwen-3-14b",
      ]);
    });

    it("should generate candidates for anthropic/claude-sonnet-4", () => {
      const candidates = generateLookupCandidates("anthropic/claude-sonnet-4");
      expect(candidates).toEqual([
        "vercel_ai_gateway/anthropic/claude-sonnet-4",
        "anthropic/claude-sonnet-4",
        "claude-sonnet-4",
      ]);
    });

    it("should generate candidates for openai/gpt-4o", () => {
      const candidates = generateLookupCandidates("openai/gpt-4o");
      expect(candidates).toEqual([
        "vercel_ai_gateway/openai/gpt-4o",
        "openai/gpt-4o",
        "gpt-4o",
      ]);
    });

    it("should generate candidates for google/gemini-2.0-flash", () => {
      const candidates = generateLookupCandidates("google/gemini-2.0-flash");
      expect(candidates).toEqual([
        "vercel_ai_gateway/google/gemini-2.0-flash",
        "google/gemini-2.0-flash",
        "gemini-2.0-flash",
      ]);
    });

    it("should generate candidates for x-ai/grok-2", () => {
      const candidates = generateLookupCandidates("x-ai/grok-2");
      expect(candidates).toEqual([
        "vercel_ai_gateway/x-ai/grok-2",
        "x-ai/grok-2",
        "grok-2",
      ]);
    });
  });

  describe("nested paths (openrouter style)", () => {
    it("should handle openrouter/anthropic/claude-sonnet-4", () => {
      const candidates = generateLookupCandidates(
        "openrouter/anthropic/claude-sonnet-4",
      );
      expect(candidates).toEqual([
        "vercel_ai_gateway/openrouter/anthropic/claude-sonnet-4",
        "openrouter/anthropic/claude-sonnet-4",
        "anthropic/claude-sonnet-4",
        "claude-sonnet-4",
      ]);
    });
  });

  describe("no provider prefix", () => {
    it("should return only the original string with gateway prefix when no separator", () => {
      const candidates = generateLookupCandidates("claude-sonnet-4");
      expect(candidates).toEqual([
        "vercel_ai_gateway/claude-sonnet-4",
        "claude-sonnet-4",
      ]);
    });
  });
});

describe("calculateCost", () => {
  const basePricing: ModelPricing = {
    inputCostPerToken: 0.000003, // $3 per MTok
    outputCostPerToken: 0.000015, // $15 per MTok
  };

  const pricingWithCache: ModelPricing = {
    ...basePricing,
    cacheReadInputTokenCost: 0.0000003, // $0.30 per MTok (10% of input)
  };

  describe("basic cost calculation", () => {
    it("should calculate cost with no cached tokens", () => {
      const result = calculateCost(basePricing, 1000, 500, 0);

      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
      expect(result.cachedInputTokens).toBe(0);
      expect(result.inputCost).toBeCloseTo(0.003); // 1000 * $3/MTok
      expect(result.outputCost).toBeCloseTo(0.0075); // 500 * $15/MTok
      expect(result.cacheReadCost).toBe(0);
      expect(result.totalCost).toBeCloseTo(0.0105);
    });

    it("should default cachedInputTokens to 0", () => {
      const result = calculateCost(basePricing, 1000, 500);

      expect(result.cachedInputTokens).toBe(0);
      expect(result.inputCost).toBeCloseTo(0.003);
    });
  });

  describe("cached token billing", () => {
    it("should bill cached tokens at reduced rate", () => {
      // 1000 input tokens, 800 are cached
      const result = calculateCost(pricingWithCache, 1000, 500, 800);

      expect(result.inputTokens).toBe(1000);
      expect(result.cachedInputTokens).toBe(800);
      // Uncached: 200 tokens * $3/MTok = $0.0006
      expect(result.inputCost).toBeCloseTo(0.0006);
      // Cached: 800 tokens * $0.30/MTok = $0.00024
      expect(result.cacheReadCost).toBeCloseTo(0.00024);
      // Output: 500 * $15/MTok = $0.0075
      expect(result.outputCost).toBeCloseTo(0.0075);
      expect(result.totalCost).toBeCloseTo(0.00834);
    });

    it("should treat cached tokens as free when no cache rate specified", () => {
      // Using basePricing which has no cacheReadInputTokenCost
      const result = calculateCost(basePricing, 1000, 500, 800);

      // Only 200 uncached tokens should be billed
      expect(result.inputCost).toBeCloseTo(0.0006);
      expect(result.cacheReadCost).toBe(0);
    });

    it("should handle all tokens being cached", () => {
      const result = calculateCost(pricingWithCache, 1000, 500, 1000);

      expect(result.inputCost).toBe(0);
      expect(result.cacheReadCost).toBeCloseTo(0.0003); // 1000 * $0.30/MTok
    });
  });

  describe("edge cases", () => {
    it("should handle zero tokens", () => {
      const result = calculateCost(basePricing, 0, 0, 0);

      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.cacheReadCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it("should handle large token counts", () => {
      const result = calculateCost(basePricing, 1_000_000, 500_000, 0);

      expect(result.inputCost).toBeCloseTo(3); // 1M * $3/MTok
      expect(result.outputCost).toBeCloseTo(7.5); // 500K * $15/MTok
      expect(result.totalCost).toBeCloseTo(10.5);
    });

    it("should handle pricing with zero costs", () => {
      const freePricing: ModelPricing = {
        inputCostPerToken: 0,
        outputCostPerToken: 0,
      };
      const result = calculateCost(freePricing, 1000, 500, 0);

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
    expect(formatMTokCost(0.30)).toBe("$0.30");
    expect(formatMTokCost(3)).toBe("$3.00");
    expect(formatMTokCost(15)).toBe("$15.00");
  });
});

describe("getModelPricingDisplay", () => {
  it("should convert per-token costs to per-MTok", () => {
    const pricing: ModelPricing = {
      inputCostPerToken: 0.000003, // $3 per MTok
      outputCostPerToken: 0.000015, // $15 per MTok
    };

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(3);
    expect(display.outputCostPerMTok).toBe(15);
    expect(display.cacheReadCostPerMTok).toBeUndefined();
  });

  it("should include cache read cost when available", () => {
    const pricing: ModelPricing = {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadInputTokenCost: 0.0000003, // $0.30 per MTok
    };

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(3);
    expect(display.outputCostPerMTok).toBe(15);
    expect(display.cacheReadCostPerMTok).toBeCloseTo(0.3);
  });

  it("should handle zero costs", () => {
    const pricing: ModelPricing = {
      inputCostPerToken: 0,
      outputCostPerToken: 0,
    };

    const display = getModelPricingDisplay(pricing);

    expect(display.inputCostPerMTok).toBe(0);
    expect(display.outputCostPerMTok).toBe(0);
  });
});
