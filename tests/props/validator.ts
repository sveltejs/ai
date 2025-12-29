import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the component uses Svelte 5's $props rune
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for $props usage
  if (!code.includes("$props")) {
    errors.push("Component must use the $props rune to accept component properties");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
