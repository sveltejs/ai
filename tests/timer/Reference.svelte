<script lang="ts">
	let elapsed = $state(0);
	let running = $state(false);
	let laps: number[] = $state([]);

	const formatted = $derived.by(() => {
		const totalMs = elapsed;
		const minutes = Math.floor(totalMs / 60000);
		const seconds = Math.floor((totalMs % 60000) / 1000);
		const ms = Math.floor((totalMs % 1000) / 10);
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
	});

	$effect(() => {
		if (running) {
			const interval = setInterval(() => {
				elapsed += 10;
			}, 10);
			return () => clearInterval(interval);
		}
	});

	function start() {
		running = true;
	}

	function pause() {
		running = false;
	}

	function reset() {
		running = false;
		elapsed = 0;
		laps = [];
	}

	function lap() {
		laps.push(elapsed);
	}

	function formatLapTime(ms: number) {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		const centiseconds = Math.floor((ms % 1000) / 10);
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
	}
</script>

<div class="timer">
	<div class="display" data-testid="display">{formatted}</div>

	<div class="controls">
		{#if !running}
			<button onclick={start} data-testid="start">Start</button>
		{:else}
			<button onclick={pause} data-testid="pause">Pause</button>
		{/if}
		<button onclick={reset} data-testid="reset">Reset</button>
		<button onclick={lap} data-testid="lap" disabled={!running}>Lap</button>
	</div>

	{#if laps.length > 0}
		<ul class="laps" data-testid="laps">
			{#each laps as lapTime, i (i)}
				<li data-testid="lap-{i}">{formatLapTime(lapTime)}</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.timer {
		font-family: monospace;
		padding: 1rem;
	}

	.display {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.laps {
		list-style: none;
		padding: 0;
	}

	.laps li {
		padding: 0.25rem 0;
		border-bottom: 1px solid #eee;
	}
</style>
