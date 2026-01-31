<svelte:options runes={true} />

<script>
	import { SvelteSet } from 'svelte/reactivity';
	let { items = [] } = $props();

	let selected = new SvelteSet();

	let all_selected = $derived(items.length > 0 && selected.size === items.length);
	let some_selected = $derived(selected.size > 0 && selected.size < items.length);
	let selected_count = $derived(selected.size);

	function toggle_all() {
		if (all_selected) {
			selected.clear();
		} else {
			for(let item of items) {
				selected.add(item.id);
			}
		}
	}

	function toggle_item(id) {
		if (selected.has(id)) {
			selected.delete(id);
		} else {
			selected.add(id);
		}
	}
</script>

<div class="checklist">
	<div class="select-all">
		<input
			type="checkbox"
			id="select-all"
			data-testid="select-all"
			checked={all_selected}
			bind:indeterminate={some_selected}
			onchange={toggle_all}
		/>
		<label for="select-all">Select all</label>
	</div>

	<ul data-testid="items">
		{#each items as item (item.id)}
			<li>
				<input
					type="checkbox"
					id="item-{item.id}"
					data-testid="item-checkbox"
					checked={selected.has(item.id)}
					onchange={() => toggle_item(item.id)}
				/>
				<label for="item-{item.id}">{item.label}</label>
			</li>
		{/each}
	</ul>

	<p data-testid="selected-count">{selected_count} selected</p>
</div>

<style>
	.checklist {
		max-width: 400px;
		margin: 0 auto;
		padding: 1rem;
		font-family: sans-serif;
	}

	.select-all {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 2px solid #ccc;
		margin-bottom: 0.5rem;
	}

	.select-all label {
		font-weight: bold;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem 0;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid #eee;
	}

	li:hover {
		background-color: #f5f5f5;
	}

	input[type="checkbox"] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	label {
		cursor: pointer;
	}

	p {
		color: #666;
		font-size: 0.875rem;
		margin: 0;
	}
</style>
