<svelte:options runes={true} />

<script>
  class Counter {
    count = $state(0);

    increment() {
      this.count++;
    }

    decrement() {
      this.count--;
    }

    reset() {
      this.count = 0;
    }
  }

  const counter = new Counter();
</script>

<div class="counter">
  <button data-testid="decrement-button" onclick={() => counter.decrement()}>-</button>
  <span data-testid="count-value">{counter.count}</span>
  <button data-testid="increment-button" onclick={() => counter.increment()}>+</button>
  <button data-testid="reset-button" onclick={() => counter.reset()}>Reset</button>
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

  button:hover {
    background-color: #cbd5e0;
  }

  span {
    font-size: 1.5rem;
    font-weight: bold;
    min-width: 2rem;
    text-align: center;
  }
</style>
