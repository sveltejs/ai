<svelte:options runes={true} />

<script>
	import { SvelteSet } from 'svelte/reactivity';
	const { items = [], single = false } = $props();
	let openIndices = new SvelteSet();

	function toggle(index) {
		if (openIndices.has(index)) {
			openIndices.delete(index);
		} else {
			if (single) {
				openIndices.clear();
			}
			openIndices.add(index);
		}
	}

	function isOpen(index) {
		return openIndices.has(index);
	}
</script>

<div class="accordion" data-testid="accordion">
	{#each items as item, index (index)}
		<div class="accordion-item" data-testid="accordion-item">
			<button
				type="button"
				data-testid="accordion-button"
				aria-expanded={isOpen(index)}
				aria-controls="panel-{index}"
				onclick={() => toggle(index)}
			>
				{item.title}
			</button>
			{#if isOpen(index)}
				<div id="panel-{index}" data-testid="accordion-panel" role="region">
					{item.content}
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.accordion {
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.accordion-item {
		border-bottom: 1px solid #ccc;
	}

	.accordion-item:last-child {
		border-bottom: none;
	}

	button {
		width: 100%;
		padding: 1rem;
		text-align: left;
		background: #f5f5f5;
		border: none;
		cursor: pointer;
		font-size: 1rem;
	}

	button:hover {
		background: #e5e5e5;
	}

	[data-testid='accordion-panel'] {
		padding: 1rem;
	}
</style>
