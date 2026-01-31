<svelte:options runes={true} />

<script>
	let { checked = $bindable(false), disabled = false, label } = $props();

	function toggle() {
		if (!disabled) {
			checked = !checked;
		}
	}

	function handleKeyDown(event) {
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault();
			toggle();
		}
	}
</script>

<div class="toggle-container">
	<span id="toggle-label" data-testid="label">{label}</span>
	<button
		type="button"
		role="switch"
		data-testid="switch"
		aria-checked={checked}
		aria-labelledby="toggle-label"
		aria-disabled={disabled}
		{disabled}
		onclick={toggle}
		onkeydown={handleKeyDown}
		class:checked
		class:disabled
	>
		<span class="toggle-thumb"></span>
	</button>
</div>

<style>
	.toggle-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	button[role="switch"] {
		position: relative;
		width: 48px;
		height: 24px;
		border: none;
		border-radius: 12px;
		background-color: #ccc;
		cursor: pointer;
		transition: background-color 0.2s;
		padding: 2px;
	}

	button[role="switch"].checked {
		background-color: #4caf50;
	}

	button[role="switch"].disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-thumb {
		display: block;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background-color: white;
		transition: transform 0.2s;
	}

	button[role="switch"].checked .toggle-thumb {
		transform: translateX(24px);
	}

	button[role="switch"]:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}

	#toggle-label {
		font-family: sans-serif;
	}
</style>
