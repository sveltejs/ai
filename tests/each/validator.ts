import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the character list component uses Svelte's {#each} block
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for {#each usage
  if (!code.includes("{#each")) {
    errors.push("Component must use the {#each} block for iteration");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
