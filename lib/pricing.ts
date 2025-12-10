import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Use import.meta for robust path resolution regardless of working directory
const __dirname = dirname(fileURLToPath(import.meta.url));
const PRICING_FILE_PATH = join(__dirname, "../data/model-pricing.json");

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
 * Provider normalization configuration
 * - strip: Remove the provider prefix when generating candidates
 * - keepNested: For nested paths like "openrouter/anthropic/model", also try "anthropic/model"
 */
interface ProviderConfig {
  strip: boolean;
  keepNested: boolean;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openrouter: { strip: true, keepNested: true },
  anthropic: { strip: true, keepNested: false },
  openai: { strip: true, keepNested: false },
  lmstudio: { strip: true, keepNested: false },
  google: { strip: true, keepNested: false },
  meta: { strip: true, keepNested: false },
  mistral: { strip: true, keepNested: false },
  cohere: { strip: true, keepNested: false },
  "x-ai": { strip: true, keepNested: false },
  deepseek: { strip: true, keepNested: false },
};

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
 * Normalize a model string by converting different separator formats
 * Vercel AI Gateway uses "provider:model" format
 * Old multi-provider setup used "provider/model" format
 * LiteLLM pricing data uses various formats
 */
function normalizeModelString(modelString: string): string {
  // Convert colon separator to slash for unified processing
  // e.g., "anthropic:claude-sonnet-4" -> "anthropic/claude-sonnet-4"
  return modelString.replace(":", "/");
}

/**
 * Generate lookup candidates for a model string using provider configuration
 * Returns candidates in priority order (most specific first)
 * 
 * Supports both formats:
 * - Vercel AI Gateway: "anthropic:claude-sonnet-4"
 * - Multi-provider: "anthropic/claude-sonnet-4"
 */
function generateLookupCandidates(modelString: string): string[] {
  const candidates: string[] = [];
  
  // Normalize the model string (convert : to /)
  const normalizedString = normalizeModelString(modelString);

  // Find matching provider config
  const slashIndex = normalizedString.indexOf("/");
  if (slashIndex === -1) {
    // No provider prefix, just use as-is
    return [modelString, normalizedString].filter((v, i, a) => a.indexOf(v) === i);
  }

  const provider = normalizedString.slice(0, slashIndex);
  const config = PROVIDER_CONFIGS[provider];
  const remainder = normalizedString.slice(slashIndex + 1);

  // Always try the original string first
  candidates.push(modelString);
  
  // Also try the normalized version (with / instead of :)
  if (normalizedString !== modelString) {
    candidates.push(normalizedString);
  }

  if (!config) {
    // Unknown provider, try original strings only
    return candidates.filter((v, i, a) => a.indexOf(v) === i);
  }

  if (config.strip) {
    // Try without our provider prefix (just the model name)
    candidates.push(remainder);
  }

  if (config.keepNested) {
    // For nested paths like "anthropic/claude-model", also try just "claude-model"
    const nestedSlashIndex = remainder.indexOf("/");
    if (nestedSlashIndex !== -1) {
      candidates.push(remainder.slice(nestedSlashIndex + 1));
    }
  }

  // Also try with common LiteLLM prefixes
  // LiteLLM often uses "provider/model" format
  if (!normalizedString.startsWith(provider + "/")) {
    candidates.push(`${provider}/${remainder}`);
  }

  // Remove duplicates while preserving order
  return candidates.filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * Extract pricing from model data if available
 */
function extractPricing(
  modelData: Record<string, unknown>,
): ModelPricing | null {
  const inputCost = modelData.input_cost_per_token;
  const outputCost = modelData.output_cost_per_token;

  if (typeof inputCost !== "number" && typeof outputCost !== "number") {
    return null;
  }

  return {
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
  };
}

/**
 * Look up pricing information for a model, returning both the pricing and the matched key
 * Returns null if pricing is not found
 */
export function lookupModelPricing(
  modelString: string,
): ModelPricingLookup | null {
  const data = loadPricingData();
  const candidates = generateLookupCandidates(modelString);

  for (const candidate of candidates) {
    const modelData = data[candidate] as Record<string, unknown> | undefined;
    if (modelData) {
      const pricing = extractPricing(modelData);
      if (pricing) {
        return { pricing, matchedKey: candidate };
      }
    }
  }

  return null;
}

/**
 * Look up pricing information for a model using an explicit key
 * Returns null if pricing is not found
 */
export function lookupModelPricingByKey(
  pricingKey: string,
): ModelPricingLookup | null {
  const data = loadPricingData();
  const modelData = data[pricingKey] as Record<string, unknown> | undefined;

  if (!modelData) {
    return null;
  }

  const pricing = extractPricing(modelData);
  if (!pricing) {
    return null;
  }

  return { pricing, matchedKey: pricingKey };
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

// Export for testing
export { generateLookupCandidates as _generateLookupCandidates };
