import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the button component uses Svelte 5 patterns
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for $props usage
  if (!code.includes("$props")) {
    errors.push("Component must use the $props rune to accept component properties");
  }

  // Check that export let is NOT used
  if (/export\s+let\s+/.test(code)) {
    errors.push("Component must NOT use 'export let' - use $props() instead");
  }

  // Check that createEventDispatcher is NOT used
  if (code.includes("createEventDispatcher")) {
    errors.push("Component must NOT use createEventDispatcher - forward events directly instead");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
