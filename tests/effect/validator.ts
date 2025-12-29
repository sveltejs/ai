import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the component uses Svelte 5's $effect rune
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for $effect usage
  if (!code.includes("$effect")) {
    errors.push("Component must use the $effect rune");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
