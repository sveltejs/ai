import type { ValidationResult } from "../../lib/validator-runner.ts";

/**
 * Validates that the toggle component follows Svelte 5 best practices
 */
export function validate(code: string): ValidationResult {
	const errors: string[] = [];

	// Must use $props() for props declaration
	if (!code.includes("$props")) {
		errors.push("Component must use $props() for props declaration");
	}

	// Must use $bindable() for checked prop
	if (!code.includes("$bindable")) {
		errors.push("Component must use $bindable() for the checked prop");
	}

	// Must have role="switch"
	if (!code.includes('role="switch"') && !code.includes("role='switch'")) {
		errors.push('Component must have role="switch" on the toggle element');
	}

	// Must have aria-checked attribute
	if (!code.includes("aria-checked")) {
		errors.push("Component must have aria-checked attribute");
	}

	// Must NOT have separate $state for checked if using $bindable
	// We check that checked is declared with $bindable, not separately with $state
	const hasBindableChecked = /checked\s*[=:]\s*\$bindable/.test(code);
	const hasSeparateStateChecked = /let\s+checked\s*=\s*\$state/.test(code);
	if (hasSeparateStateChecked && !hasBindableChecked) {
		errors.push("Component must NOT use separate $state for checked when using $bindable - use $bindable() directly in $props()");
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
