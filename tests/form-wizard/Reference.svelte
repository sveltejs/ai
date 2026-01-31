<svelte:options runes={true} />

<script>
	const { steps = [] } = $props();
	
	let current_step = $state(0);
	let form_data = $state({});
	let errors = $state({});
	
	let is_first_step = $derived(current_step === 0);
	let is_last_step = $derived(current_step === steps.length - 1);
	let current_step_data = $derived(steps[current_step]);
	
	function validate_current_step() {
		const step_errors = {};
		const step = steps[current_step];
		
		if (!step) return true;
		
		for (const field of step.fields) {
			if (field.required && !form_data[field.name]?.trim()) {
				step_errors[field.name] = `${field.label} is required`;
			}
		}
		
		errors = step_errors;
		return Object.keys(step_errors).length === 0;
	}
	
	function next() {
		if (validate_current_step()) {
			current_step++;
		}
	}
	
	function previous() {
		if (current_step > 0) {
			errors = {};
			current_step--;
		}
	}
	
	function submit() {
		if (validate_current_step()) {
			// Form submitted successfully
			console.log('Form submitted:', form_data);
		}
	}
</script>

<div class="form-wizard">
	<div class="step-indicator" data-testid="step-indicator">
		Step {current_step + 1} of {steps.length}
	</div>
	
	{#if current_step_data}
		<h2 class="step-title" data-testid="step-title">{current_step_data.title}</h2>
		
		<div class="fields">
			{#each current_step_data.fields as field (field.name)}
				<div class="field" data-testid="field-{field.name}">
					<label for={field.name}>
						{field.label}
						{#if field.required}<span class="required">*</span>{/if}
					</label>
					<input
						id={field.name}
						type="text"
						data-testid="input-{field.name}"
						bind:value={form_data[field.name]}
					/>
					{#if errors[field.name]}
						<span class="error" data-testid="error-{field.name}">{errors[field.name]}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	
	<div class="navigation">
		<button
			type="button"
			data-testid="prev-button"
			disabled={is_first_step}
			onclick={previous}
		>
			Previous
		</button>
		
		{#if is_last_step}
			<button
				type="button"
				data-testid="submit-button"
				onclick={submit}
			>
				Submit
			</button>
		{:else}
			<button
				type="button"
				data-testid="next-button"
				onclick={next}
			>
				Next
			</button>
		{/if}
	</div>
</div>

<style>
	.form-wizard {
		max-width: 500px;
		padding: 1.5rem;
		font-family: sans-serif;
	}
	
	.step-indicator {
		text-align: center;
		color: #666;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}
	
	.step-title {
		margin: 0 0 1.5rem;
		font-size: 1.25rem;
	}
	
	.fields {
		margin-bottom: 1.5rem;
	}
	
	.field {
		margin-bottom: 1rem;
	}
	
	label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 500;
	}
	
	.required {
		color: #dc3545;
	}
	
	input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}
	
	input:focus {
		outline: 2px solid #007bff;
		outline-offset: 1px;
	}
	
	.error {
		display: block;
		color: #dc3545;
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}
	
	.navigation {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	
	button {
		padding: 0.75rem 1.5rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
	}
	
	button:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	button:not(:disabled):hover {
		background-color: #0056b3;
	}
</style>
