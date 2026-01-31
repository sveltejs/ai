<svelte:options runes={true} />

<script>
  let { initialValue = 0, min = -Infinity, max = Infinity } = $props();
  let count = $derived(initialValue);

  let atMin = $derived(count <= min);
  let atMax = $derived(count >= max);

  function increment() {
    if (!atMax) {
      count++;
    }
  }

  function decrement() {
    if (!atMin) {
      count--;
    }
  }

  function reset() {
    count = initialValue;
  }
</script>

<div class="counter">
  <button
    data-testid="decrement-button"
    aria-label="decrement"
    onclick={decrement}
    disabled={atMin}
  >
    -
  </button>
  <span data-testid="count-value">{count}</span>
  <button
    data-testid="increment-button"
    aria-label="increment"
    onclick={increment}
    disabled={atMax}
  >
    +
  </button>
  <button data-testid="reset-button" aria-label="reset" onclick={reset}>
    Reset
  </button>
</div>

<style>
  .counter {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  button {
    background-color: #e2e8f0;
    border: none;
    border-radius: 0.25rem;
    padding: 0.5rem 1rem;
    font-size: 1.25rem;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background-color: #cbd5e0;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  span {
    font-size: 1.5rem;
    font-weight: bold;
    min-width: 2rem;
    text-align: center;
  }
</style>
