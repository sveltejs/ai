import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the counter-bounds component uses proper Svelte 5 patterns:
 * - Must use $derived() for atMin/atMax/count bounds checking
 * - Must NOT use $effect for bounds checking
 * - Must NOT use legacy export let syntax
 */
export function validate(code: string): ValidationResult {
  const errors: string[] = [];

  // Check for $derived usage for bounds checking
  if (!code.includes("$derived")) {
    errors.push(
      "Component must use the $derived rune for atMin/atMax/count bounds checking",
    );
  }

  // Should NOT use $effect for bounds checking - derived is the correct pattern
  // Match $effect but not $effect.pre or $effect.tracking etc to be precise
  const effectPattern = /\$effect\s*\(/;
  if (effectPattern.test(code)) {
    errors.push(
      "Component should NOT use $effect for bounds checking - use $derived instead",
    );
  }

  // Should NOT use legacy export let syntax
  if (code.includes("export let")) {
    errors.push(
      "Component should NOT use legacy 'export let' syntax - use $props() instead",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
