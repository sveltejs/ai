<svelte:options runes={true} />

<script>
	// Single source of truth - store temperature in Celsius
	let celsius = $state(0);

	// Derived values for display
	let fahrenheit = $derived(round(celsius * 9 / 5 + 32));
	let kelvin = $derived(round(celsius + 273.15));

	function round(value) {
		return Math.round(value * 100) / 100;
	}

	function handleCelsiusInput(event) {
		const value = parseFloat(event.target.value);
		if (!isNaN(value)) {
			celsius = value;
		}
	}

	function handleFahrenheitInput(event) {
		const value = parseFloat(event.target.value);
		if (!isNaN(value)) {
			celsius = (value - 32) * 5 / 9;
		}
	}

	function handleKelvinInput(event) {
		const value = parseFloat(event.target.value);
		if (!isNaN(value)) {
			celsius = value - 273.15;
		}
	}
</script>

<div class="temperature-converter">
	<div class="input-group">
		<label for="celsius">Celsius</label>
		<input
			id="celsius"
			type="number"
			step="any"
			data-testid="celsius-input"
			value={celsius}
			oninput={handleCelsiusInput}
		/>
	</div>

	<div class="input-group">
		<label for="fahrenheit">Fahrenheit</label>
		<input
			id="fahrenheit"
			type="number"
			step="any"
			data-testid="fahrenheit-input"
			value={fahrenheit}
			oninput={handleFahrenheitInput}
		/>
	</div>

	<div class="input-group">
		<label for="kelvin">Kelvin</label>
		<input
			id="kelvin"
			type="number"
			step="any"
			data-testid="kelvin-input"
			value={kelvin}
			oninput={handleKelvinInput}
		/>
	</div>
</div>

<style>
	.temperature-converter {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		max-width: 300px;
		font-family: sans-serif;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label {
		font-weight: 600;
		color: #333;
	}

	input {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
	}
</style>
