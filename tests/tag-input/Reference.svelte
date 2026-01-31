<svelte:options runes={true} />

<script>
	let { maxTags = Infinity, allowDuplicates = false } = $props();
	
	let tags = $state([]);
	let input_value = $state("");
	
	let can_add_more = $derived(tags.length < maxTags);
	
	function add_tag(value) {
		const trimmed = value.trim();
		if (!trimmed) return false;
		if (!can_add_more) return false;
		if (!allowDuplicates && tags.includes(trimmed)) return false;
		
		tags.push(trimmed);
		return true;
	}
	
	function remove_tag(index) {
		tags.splice(index, 1);
	}
	
	function handle_keydown(event) {
		if (event.key === "Enter") {
			event.preventDefault();
			if (add_tag(input_value)) {
				input_value = "";
			}
		} else if (event.key === "Backspace" && input_value === "") {
			if (tags.length > 0) {
				tags.pop();
			}
		}
	}
	
	function handle_input(event) {
		const value = event.target.value;
		// Check if input contains comma
		if (value.includes(",")) {
			const parts = value.split(",");
			// Add all complete parts (everything before the last part)
			for (let i = 0; i < parts.length - 1; i++) {
				add_tag(parts[i]);
			}
			// Keep the last part in the input (text after the last comma)
			input_value = parts[parts.length - 1];
		} else {
			input_value = value;
		}
	}
</script>

<div class="tag-input" data-testid="tag-input-container">
	<div class="tags" data-testid="tags-container">
		{#each tags as tag, i (tag + "-" + i)}
			<span class="tag" data-testid="tag">
				<span data-testid="tag-text">{tag}</span>
				<button
					type="button"
					class="remove-button"
					data-testid="remove-tag-button"
					aria-label="Remove {tag}"
					onclick={() => remove_tag(i)}
				>
					&times;
				</button>
			</span>
		{/each}
	</div>
	<input
		type="text"
		data-testid="tag-input"
		value={input_value}
		oninput={handle_input}
		onkeydown={handle_keydown}
		placeholder={can_add_more ? "Add a tag..." : "Max tags reached"}
		disabled={!can_add_more}
	/>
</div>

<style>
	.tag-input {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-height: 2.5rem;
	}
	
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background-color: #e2e8f0;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
	}
	
	.remove-button {
		background: none;
		border: none;
		font-size: 1rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		color: #666;
	}
	
	.remove-button:hover {
		color: #333;
	}
	
	input {
		flex: 1;
		min-width: 100px;
		border: none;
		outline: none;
		padding: 0.25rem;
		font-size: 1rem;
	}
	
	input:disabled {
		background: transparent;
		cursor: not-allowed;
	}
</style>
