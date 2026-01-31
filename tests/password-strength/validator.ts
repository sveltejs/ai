import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the password strength component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $state() for password and showPassword
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for password and show_password variables");
	}

	// Must use $derived() for criteria and strength
	if (!code.includes("$derived")) {
		errors.push("Component must use $derived() for all criteria and strength calculation");
	}

	// Must NOT use $effect for computing strength
	if (code.includes("$effect")) {
		errors.push("Component must NOT use $effect for computing strength - use $derived instead");
	}

	// Must NOT use export let (Svelte 4 syntax)
	if (code.includes("export let")) {
		errors.push("Component must NOT use 'export let' - this is Svelte 4 syntax");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
