<svelte:options runes={true} />

<script>
  let { children, header } = $props();
</script>

<div data-testid="card" class="card">
  {#if header}
    <div data-testid="card-header" class="header">
      {@render header()}
    </div>
  {/if}
  <div data-testid="card-content" class="content">
    {@render children()}
  </div>
</div>

<style>
  .card {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .header {
    background-color: #f7fafc;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    font-weight: bold;
  }

  .content {
    padding: 1rem;
  }
</style>
