import type { extractPricingFromGatewayModel } from "./pricing.ts";

export class TokenCache {
  private currentTokens: number;
  private totalCachedTokens: number = 0;
  private messages: Array<{ message: string; tokens: number }> = [];
  private pricing: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>> | null;
  private totalOutputTokens: number = 0;

  constructor(
    tokens: number,
    pricing?: NonNullable<ReturnType<typeof extractPricingFromGatewayModel>> | null,
  ) {
    this.currentTokens = tokens;
    this.pricing = pricing ?? null;
  }

  addMessage(message: string, tokens: number, outputTokens: number = 0): void {
    // The existing tokens are served from cache on this call
    this.totalCachedTokens += this.currentTokens;

    // Now add the new message to our running total
    this.currentTokens += tokens;
    this.totalOutputTokens += outputTokens;
    this.messages.push({ message, tokens });
  }

  getCacheStats() {
    return {
      totalCachedTokens: this.totalCachedTokens,
      currentContextTokens: this.currentTokens,
      messageCount: this.messages.length,
    };
  }

  calculateCost(): {
    simulatedCost: number;
    cacheReadCost: number;
    inputCost: number;
    outputCost: number;
  } {
    if (!this.pricing) {
      return {
        simulatedCost: 0,
        cacheReadCost: 0,
        inputCost: 0,
        outputCost: 0,
      };
    }

    const cacheReadRate =
      this.pricing.cacheReadInputTokenCost ??
      this.pricing.inputCostPerToken * 0.1;

    // Cached tokens at cache read rate
    const cacheReadCost = this.totalCachedTokens * cacheReadRate;

    // Current tokens (uncached portion) at full input rate
    const inputCost = this.currentTokens * this.pricing.inputCostPerToken;

    // Output tokens at output rate
    const outputCost = this.totalOutputTokens * this.pricing.outputCostPerToken;

    return {
      simulatedCost: cacheReadCost + inputCost + outputCost,
      cacheReadCost,
      inputCost,
      outputCost,
    };
  }
}
