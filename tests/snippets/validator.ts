import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the book list component uses Svelte 5's snippets feature
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for {#snippet usage
  if (!code.includes("{#snippet")) {
    errors.push("Component must define snippets using {#snippet}");
  }

  // Check for {@render usage
  if (!code.includes("{@render")) {
    errors.push("Component must render snippets using {@render}");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
