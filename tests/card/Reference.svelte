<script>
	/**
	 * @type {{ 
	 *   variant?: 'elevated' | 'outlined', 
	 *   children: import('svelte').Snippet, 
	 *   header?: import('svelte').Snippet, 
	 *   footer?: import('svelte').Snippet 
	 * }}
	 */
	let { variant = 'elevated', children, header, footer } = $props();
</script>

<div class="card {variant}" data-testid="card">
	{#if header}
		<div class="card-header" data-testid="card-header">
			{@render header()}
		</div>
	{/if}
	
	<div class="card-body" data-testid="card-body">
		{@render children?.()}
	</div>
	
	{#if footer}
		<div class="card-footer" data-testid="card-footer">
			{@render footer()}
		</div>
	{/if}
</div>

<style>
	.card {
		border-radius: 8px;
		overflow: hidden;
	}

	.card.elevated {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		background: white;
	}

	.card.outlined {
		border: 1px solid #e0e0e0;
		background: white;
	}

	.card-header {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
		font-weight: 600;
	}

	.card-footer {
		padding: 1rem;
		border-top: 1px solid #e0e0e0;
	}
</style>
