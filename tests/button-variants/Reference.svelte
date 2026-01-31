<svelte:options runes={true} />

<script>
  const { variant = "primary", size = "md", disabled = false, onclick, children } = $props();
</script>

<button class="{variant} {size}" {disabled} {onclick}>
  {@render children?.()}
</button>

<style>
  button {
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Variants */
  .primary {
    background-color: #3b82f6;
    color: white;
  }

  .primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .secondary {
    background-color: #6b7280;
    color: white;
  }

  .secondary:hover:not(:disabled) {
    background-color: #4b5563;
  }

  .danger {
    background-color: #ef4444;
    color: white;
  }

  .danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  /* Sizes */
  .sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
  }

  .md {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }

  .lg {
    padding: 0.75rem 1.5rem;
    font-size: 1.125rem;
  }
</style>
