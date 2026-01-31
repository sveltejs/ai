import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the temperature converter component uses proper Svelte 5 patterns:
 * - Single $state() as source of truth
 * - $derived() for other temperature scales
 * - No multiple $state that update each other (causes loops)
 * - No $effect for conversions
 * - No export let (Svelte 4 pattern)
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must have $state() for the source of truth
	if (!code.includes("$state")) {
		errors.push("Component must use $state() for the source of truth temperature value");
	}

	// Must use $derived() for calculated values
	if (!code.includes("$derived")) {
		errors.push("Component must use $derived() for the other temperature scales");
	}

	// Must NOT use $effect for conversions (anti-pattern that causes loops)
	if (code.includes("$effect")) {
		errors.push(
			"Component should NOT use $effect for temperature conversions. " +
				"Use $derived() instead for reactive calculations.",
		);
	}

	// Must NOT use export let (Svelte 4 pattern)
	if (/export\s+let\s+/.test(code)) {
		errors.push(
			"Component should NOT use 'export let' (Svelte 4 pattern). " +
				"Use $props() for Svelte 5 if props are needed.",
		);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
