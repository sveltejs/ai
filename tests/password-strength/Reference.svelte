<svelte:options runes={true} />

<script>
	let password = $state("");
	let show_password = $state(false);

	let has_length = $derived(password.length >= 8);
	let has_uppercase = $derived(/[A-Z]/.test(password));
	let has_lowercase = $derived(/[a-z]/.test(password));
	let has_number = $derived(/[0-9]/.test(password));
	let has_special = $derived(/[!@#$%^&*(),.?":{}|<>]/.test(password));

	let criteria_met = $derived(
		[has_length, has_uppercase, has_lowercase, has_number, has_special].filter(Boolean).length
	);

	let strength = $derived.by(() => {
		if (criteria_met <= 1) return "weak";
		if (criteria_met <= 2) return "fair";
		if (criteria_met <= 3) return "strong";
		return "very strong";
	});

	function toggle_visibility() {
		show_password = !show_password;
	}
</script>

<div class="password-checker">
	<div class="input-group">
		<input
			type={show_password ? "text" : "password"}
			data-testid="password-input"
			bind:value={password}
			placeholder="Enter password"
		/>
		<button type="button" data-testid="toggle-visibility" onclick={toggle_visibility}>
			{show_password ? "Hide" : "Show"}
		</button>
	</div>

	<div class="strength-meter" data-testid="strength-meter">
		Strength: <span data-testid="strength-value">{strength}</span>
	</div>

	<ul class="criteria-list" data-testid="criteria-list">
		<li class={{ met: has_length }} data-testid="criteria-length">
			At least 8 characters
		</li>
		<li class={{ met: has_uppercase }} data-testid="criteria-uppercase">
			Contains uppercase letter
		</li>
		<li class={{ met: has_lowercase }} data-testid="criteria-lowercase">
			Contains lowercase letter
		</li>
		<li class={{ met: has_number }} data-testid="criteria-number">
			Contains number
		</li>
		<li class={{ met: has_special }} data-testid="criteria-special">
			Contains special character
		</li>
	</ul>
</div>

<style>
	.password-checker {
		max-width: 400px;
		padding: 1rem;
		font-family: sans-serif;
	}

	.input-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:hover {
		background-color: #0056b3;
	}

	.strength-meter {
		margin-bottom: 1rem;
		font-weight: bold;
	}

	.criteria-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.criteria-list li {
		padding: 0.25rem 0;
		color: #dc3545;
	}

	.criteria-list li::before {
		content: "✗ ";
	}

	.criteria-list li.met {
		color: #28a745;
	}

	.criteria-list li.met::before {
		content: "✓ ";
	}
</style>
