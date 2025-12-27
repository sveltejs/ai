import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the counter component uses Svelte 5's $state rune
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for $state usage
  if (!code.includes("$state")) {
    errors.push("Component must use the $state rune for reactivity");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
