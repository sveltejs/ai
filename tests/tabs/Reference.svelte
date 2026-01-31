<svelte:options runes={true} />

<script>
	const { tabs = [] } = $props();
	let activeIndex = $state(0);
	let tabRefs = $state([]);

	function handleKeyDown(event, index) {
		if (event.key === "ArrowRight") {
			event.preventDefault();
			const nextIndex = (index + 1) % tabs.length;
			activeIndex = nextIndex;
			tabRefs[nextIndex]?.focus();
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			const prevIndex = (index - 1 + tabs.length) % tabs.length;
			activeIndex = prevIndex;
			tabRefs[prevIndex]?.focus();
		}
	}

	function selectTab(index) {
		activeIndex = index;
	}
</script>

<div class="tabs">
	<div role="tablist" data-testid="tablist">
		{#each tabs as tab, index (index)}
			<button
				type="button"
				role="tab"
				data-testid="tab"
				id="tab-{index}"
				aria-selected={activeIndex === index}
				aria-controls="tabpanel-{index}"
				tabindex={activeIndex === index ? 0 : -1}
				bind:this={tabRefs[index]}
				onclick={() => selectTab(index)}
				onkeydown={(e) => handleKeyDown(e, index)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#each tabs as tab, index (index)}
		{#if activeIndex === index}
			<div
				role="tabpanel"
				data-testid="tabpanel"
				id="tabpanel-{index}"
				aria-labelledby="tab-{index}"
			>
				{tab.content}
			</div>
		{/if}
	{/each}
</div>

<style>
	.tabs {
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	[role="tablist"] {
		display: flex;
		border-bottom: 1px solid #ccc;
		background: #f5f5f5;
	}

	[role="tab"] {
		padding: 0.75rem 1rem;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 1rem;
	}

	[role="tab"][aria-selected="true"] {
		background: white;
		border-bottom: 2px solid #007bff;
	}

	[role="tab"]:hover {
		background: #e5e5e5;
	}

	[role="tab"]:focus {
		outline: 2px solid #007bff;
		outline-offset: -2px;
	}

	[role="tabpanel"] {
		padding: 1rem;
	}
</style>
