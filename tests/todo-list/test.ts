import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import TodoList from "./Component.svelte";

async function setupInitialTodos(todos: { id: number; text: string; done: boolean }[], user: ReturnType<typeof userEvent.setup>) {
		const input = screen.getByTestId("todo-input");
		const addButton = screen.getByTestId("add-button");
		for (const todo of todos) {
			await user.type(input, todo.text);
			await user.click(addButton);
			if(todo.done) {
				const checkbox = screen.getAllByTestId("todo-checkbox").at(-1);
				await user.click(checkbox!);
			}
		}
}

describe("TodoList component", () => {
	test("can add todo - render, type in textbox, submit form, verify new todo appears", async () => {
		const user = userEvent.setup();
		render(TodoList);

		const input = screen.getByTestId("todo-input");
		const form = screen.getByTestId("todo-form");

		// Type a todo
		await user.type(input, "Buy groceries");

		// Submit the form
		const addButton = screen.getByTestId("add-button");
		await user.click(addButton);

		// Verify new todo appears
		const todoItems = screen.getAllByTestId("todo-item");
		expect(todoItems.length).toBe(1);
		expect(screen.getByTestId("todo-text")).toHaveTextContent("Buy groceries");
	});

	test("toggle marks complete - render with initial todo, click checkbox, verify checkbox is checked", async () => {
		const user = userEvent.setup();
		render(TodoList);

		await setupInitialTodos([{ id: 1, text: "Test todo", done: false }], user);

		const checkbox = screen.getByTestId("todo-checkbox");

		// Initial state - unchecked
		expect(checkbox).not.toBeChecked();

		// Click checkbox
		await user.click(checkbox);

		// Verify checkbox is now checked
		expect(checkbox).toBeChecked();
	});

	test("delete removes todo - render with initial todo, click delete button, verify todo is gone", async () => {
		const user = userEvent.setup();
		render(TodoList);

		await setupInitialTodos([{ id: 1, text: "Test todo", done: false }], user);

		// Verify todo exists
		expect(screen.getByTestId("todo-item")).toBeInTheDocument();
		expect(screen.getByTestId("todo-text")).toHaveTextContent("Test todo");

		// Click delete button
		const deleteButton = screen.getByTestId("delete-button");
		await user.click(deleteButton);

		// Verify todo is gone
		expect(screen.queryByTestId("todo-item")).not.toBeInTheDocument();
	});

	test("shows remaining count - render with 2 todos (1 done, 1 not), verify shows correct count", async () => {
		const user = userEvent.setup();
		render(TodoList);

		await setupInitialTodos(
			[
				{ id: 1, text: "Done todo", done: true },
				{ id: 2, text: "Pending todo", done: false },
			],
			user
		);

		const countElement = screen.getByTestId("remaining-count");
		// Should show "1 item left" or similar (only count incomplete todos)
		expect(countElement).toHaveTextContent(/1\s*(item|todo)/i);
	});

	test("empty input doesn't add - submit empty form, verify no todo added", async () => {
		const user = userEvent.setup();
		render(TodoList);

		const input = screen.getByTestId("todo-input");
		const addButton = screen.getByTestId("add-button");

		// Ensure input is empty
		expect(input).toHaveValue("");

		// Submit the form
		await user.click(addButton);

		// Verify no todo was added
		expect(screen.queryByTestId("todo-item")).not.toBeInTheDocument();
	});

	test("form resets after add - add a todo, verify input is cleared", async () => {
		const user = userEvent.setup();
		render(TodoList);

		const input = screen.getByTestId("todo-input");
		const addButton = screen.getByTestId("add-button");

		// Type a todo
		await user.type(input, "New todo");
		expect(input).toHaveValue("New todo");

		// Submit the form
		await user.click(addButton);

		// Verify input is cleared
		expect(input).toHaveValue("");
	});
});
