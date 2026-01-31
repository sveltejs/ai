import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the card component uses Svelte 5 patterns for slots
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Check for {@render usage for slots
	if (!code.includes("{@render")) {
		errors.push("Component must use {@render} to render snippets/slots");
	}

	// Check for {#if conditional rendering
	if (!code.includes("{#if")) {
		errors.push("Component must use {#if} to conditionally render slot wrappers");
	}

	// Check that <slot> element is NOT used (Svelte 4 pattern)
	if (/<slot[\s/>]/.test(code)) {
		errors.push("Component must NOT use <slot> element - use snippets and {@render} instead");
	}

	// Check that export let is NOT used
	if (/export\s+let\s+/.test(code)) {
		errors.push("Component must NOT use 'export let' - use $props() instead");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
