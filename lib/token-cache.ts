import type { extractPricingFromGatewayModel } from "./pricing.ts";

export class TokenCache {
  private currentTokens: number;
  private totalCachedTokens: number = 0;
  private messages: Array<{ message: string; tokens: number }> = [];
  private pricing: NonNullable<
    ReturnType<typeof extractPricingFromGatewayModel>
  > | null;
  private totalOutputTokens: number = 0;

  constructor(
    tokens: number,
    pricing?: NonNullable<
      ReturnType<typeof extractPricingFromGatewayModel>
    > | null,
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

  calculateSimulatedCost(): {
    simulatedCost: number;
    cacheReadCost: number;
    cacheWriteCost: number;
    outputCost: number;
  } {
    if (
      !this.pricing ||
      !this.pricing.cacheReadInputTokenCost ||
      !this.pricing.cacheCreationInputTokenCost
    ) {
      return {
        simulatedCost: 0,
        cacheReadCost: 0,
        cacheWriteCost: 0,
        outputCost: 0,
      };
    }

    const cacheReadRate = this.pricing.cacheReadInputTokenCost;

    const cacheWriteRate = this.pricing.cacheCreationInputTokenCost;

    // Tokens read from cache across all API calls
    const cacheReadCost = this.totalCachedTokens * cacheReadRate;

    // Tokens written to cache across all API calls (all current tokens were written at some point)
    const cacheWriteCost = this.currentTokens * cacheWriteRate;

    // Output tokens at output rate
    const outputCost = this.totalOutputTokens * this.pricing.outputCostPerToken;

    return {
      simulatedCost: cacheReadCost + cacheWriteCost + outputCost,
      cacheReadCost,
      cacheWriteCost,
      outputCost,
    };
  }
}
