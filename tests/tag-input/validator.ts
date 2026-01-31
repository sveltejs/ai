import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the tag input component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $state() for tags array
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for the tags array");
	}

	// Must use $derived() for canAddMore
	if (!code.includes("$derived")) {
		errors.push("Component must use $derived() for the canAddMore computed value");
	}

	// Must use {#each ... as ... (key)} with a key
	const eachRegex = /\{#each\s+\w+\s+as\s+\w+\s*,?\s*\w*\s*\([^)]+\)/;
	if (!eachRegex.test(code)) {
		errors.push("Component must use {#each tags as tag (key)} with a unique key for proper list rendering");
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
