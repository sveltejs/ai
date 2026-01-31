import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the checklist component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $state() for selected Set/array
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for the selected Set/array");
	}

	// Must use $derived() for allSelected and someSelected
	if (!code.includes("$derived")) {
		errors.push("Component must use $derived() for allSelected, someSelected, and selectedCount");
	}

	// Must use $derived() for allSelected and someSelected
	if (code.includes("$effect")) {
		errors.push("Component must not use $effect()");
	}

	// Must NOT use export let (Svelte 4 syntax)
	if (code.includes("export let")) {
		errors.push("Component must NOT use 'export let' - use $props() instead");
	}

	// Must use $props() for items
	if (!code.includes("$props")) {
		errors.push("Component must use $props() to receive items prop");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
