<script>
	let { items, searchFields, children } = $props();
	
	let query = $state('');
	
	let filtered_items = $derived(
		items.filter((item) => {
			if (!query.trim()) return true;
			const search_term = query.toLowerCase();
			return searchFields.some((field) => {
				const value = item[field];
				return value && String(value).toLowerCase().includes(search_term);
			});
		})
	);
	
	let result_count = $derived(filtered_items.length);
</script>

<input
	role="searchbox"
	bind:value={query}
	placeholder="Search..."
/>

<p>{result_count} results</p>

{#each filtered_items as item (item[searchFields[0]])}
	{@render children(item)}
{/each}
