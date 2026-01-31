import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the accordion component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must have aria-expanded attributes
	if (!code.includes("aria-expanded")) {
		errors.push("Component must have aria-expanded attributes for accessibility");
	}

	// Must NOT use $effect for UI state
	if (code.includes("$effect")) {
		errors.push("Component should NOT use $effect for UI state management");
	}

	// Must NOT use export let (Svelte 4 syntax)
	if (code.includes("export let")) {
		errors.push("Component must NOT use 'export let' - use $props() instead");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
