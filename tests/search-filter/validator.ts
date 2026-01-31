import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the search filter component uses proper Svelte 5 patterns
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $state() for search term
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for the search term");
	}

	// Must use $derived() for filtered items and count
	if (!code.includes("$derived")) {
		errors.push("Component must use $derived() for filtered items and result count");
	}

	// Must use $derived() for filtered items and count
	if (!code.includes("@render")) {
		errors.push("Component must use @render for rendering children");
	}

	// Must NOT use $effect for filtering
	if (code.includes("$effect")) {
		errors.push("Component must NOT use $effect for filtering - use $derived instead");
	}

	// Must NOT use export let (legacy Svelte 4 syntax)
	if (code.includes("export let")) {
		errors.push("Component must NOT use 'export let' - use $props() instead");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
