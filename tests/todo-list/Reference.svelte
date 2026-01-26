<svelte:options runes={true} />

<script>
	let todos = $state([]);
	let input_value = $state("");
	
	let remaining_count = $derived(todos.filter(t => !t.done).length);
	
	function add_todo(event) {
		event.preventDefault();
		if (input_value.trim() === "") return;
		
		todos.push({
			id: Date.now(),
			text: input_value.trim(),
			done: false
		});
		input_value = "";
	}
	
	function toggle_todo(id) {
		const todo = todos.find(t => t.id === id);
		if (todo) {
			todo.done = !todo.done;
		}
	}
	
	function delete_todo(id) {
		const index = todos.findIndex(t => t.id === id);
		if (index !== -1) {
			todos.splice(index, 1);
		}
	}
</script>

<div class="todo-list">
	<form data-testid="todo-form" onsubmit={add_todo}>
		<input
			type="text"
			data-testid="todo-input"
			bind:value={input_value}
			placeholder="Add a todo..."
		/>
		<button type="submit" data-testid="add-button">Add</button>
	</form>
	
	<ul data-testid="todo-items">
		{#each todos as todo (todo.id)}
			<li data-testid="todo-item">
				<input
					type="checkbox"
					data-testid="todo-checkbox"
					checked={todo.done}
					onchange={() => toggle_todo(todo.id)}
				/>
				<span data-testid="todo-text" class:done={todo.done}>{todo.text}</span>
				<button
					type="button"
					data-testid="delete-button"
					onclick={() => delete_todo(todo.id)}
				>
					Delete
				</button>
			</li>
		{/each}
	</ul>
	
	<p data-testid="remaining-count">{remaining_count} {remaining_count === 1 ? "item" : "items"} left</p>
</div>

<style>
	.todo-list {
		max-width: 400px;
		margin: 0 auto;
		padding: 1rem;
	}
	
	form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	
	input[type="text"] {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}
	
	button {
		padding: 0.5rem 1rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
	
	button:hover {
		background-color: #0056b3;
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
	
	li span {
		flex: 1;
	}
	
	li span.done {
		text-decoration: line-through;
		color: #888;
	}
	
	li button {
		background-color: #dc3545;
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
	}
	
	li button:hover {
		background-color: #c82333;
	}
	
	input[type="checkbox"] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}
	
	p {
		color: #666;
		font-size: 0.875rem;
	}
</style>
