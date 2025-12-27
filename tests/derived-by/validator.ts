import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the text analyzer component uses Svelte 5's $derived.by rune
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for $derived.by usage - this is the specific rune for complex derivations
  if (!code.includes("$derived.by")) {
    errors.push(
      "Component must use the $derived.by rune for complex derivations",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
