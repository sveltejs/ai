import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the form wizard component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $state() for currentStep and formData
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for current_step and form_data");
	}

	// Must use $derived() for isFirstStep, isLastStep
	if (!code.includes("$derived")) {
		errors.push("Component must use $derived() for is_first_step, is_last_step calculations");
	}

	// Must NOT use $effect for step management
	if (code.includes("$effect")) {
		errors.push("Component must NOT use $effect for step management - use $derived instead");
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
