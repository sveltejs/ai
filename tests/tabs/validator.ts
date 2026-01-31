import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the tabs component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $state() for activeIndex
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for managing activeIndex");
	}

	// Must NOT use $: reactive statements (Svelte 4 syntax)
	if (code.includes("$effect")) {
		errors.push("Component must NOT use '$effect'");
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
