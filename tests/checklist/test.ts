import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import Checklist from "./Component.svelte";

const testItems = [
	{ id: 1, label: "Item 1" },
	{ id: 2, label: "Item 2" },
	{ id: 3, label: "Item 3" },
];

describe("Checklist component", () => {
	test("select all checks all items - click select all, verify all checkboxes are checked", async () => {
		const user = userEvent.setup();
		render(Checklist, { props: { items: testItems } });

		const selectAll = screen.getByTestId("select-all");
		const itemCheckboxes = screen.getAllByTestId("item-checkbox");

		// Initially none are checked
		itemCheckboxes.forEach((checkbox) => {
			expect(checkbox).not.toBeChecked();
		});

		// Click select all
		await user.click(selectAll);

		// All should be checked
		itemCheckboxes.forEach((checkbox) => {
			expect(checkbox).toBeChecked();
		});
	});

	test("select all unchecks all when all selected - when all selected, click select all, verify all unchecked", async () => {
		const user = userEvent.setup();
		render(Checklist, { props: { items: testItems } });

		const selectAll = screen.getByTestId("select-all");
		const itemCheckboxes = screen.getAllByTestId("item-checkbox");

		// First select all
		await user.click(selectAll);

		// Verify all are checked
		itemCheckboxes.forEach((checkbox) => {
			expect(checkbox).toBeChecked();
		});

		// Click select all again to uncheck all
		await user.click(selectAll);

		// All should be unchecked
		itemCheckboxes.forEach((checkbox) => {
			expect(checkbox).not.toBeChecked();
		});
	});

	test("indeterminate when partial - check one item, verify select all has indeterminate=true", async () => {
		const user = userEvent.setup();
		render(Checklist, { props: { items: testItems } });

		const selectAll = screen.getByTestId("select-all") as HTMLInputElement;
		const itemCheckboxes = screen.getAllByTestId("item-checkbox");

		// Initially indeterminate should be false (none selected)
		expect(selectAll.indeterminate).toBe(false);

		// Check one item
		await user.click(itemCheckboxes[0]!);

		// Indeterminate should be true (partial selection)
		expect(selectAll.indeterminate).toBe(true);
	});

	test("shows selected count - select 2 items, verify count shows '2 selected'", async () => {
		const user = userEvent.setup();
		render(Checklist, { props: { items: testItems } });

		const countElement = screen.getByTestId("selected-count");
		const itemCheckboxes = screen.getAllByTestId("item-checkbox");

		// Initially shows 0 selected
		expect(countElement).toHaveTextContent("0 selected");

		// Select 2 items
		await user.click(itemCheckboxes[0]!);
		await user.click(itemCheckboxes[1]!);

		// Should show "2 selected"
		expect(countElement).toHaveTextContent("2 selected");
	});

	test("individual item toggle works - click an item, verify it toggles", async () => {
		const user = userEvent.setup();
		render(Checklist, { props: { items: testItems } });

		const itemCheckboxes = screen.getAllByTestId("item-checkbox");
		const firstItem = itemCheckboxes[0]!;

		// Initially unchecked
		expect(firstItem).not.toBeChecked();

		// Click to check
		await user.click(firstItem);
		expect(firstItem).toBeChecked();

		// Click again to uncheck
		await user.click(firstItem);
		expect(firstItem).not.toBeChecked();
	});

	test("select all not indeterminate when none selected - verify indeterminate is false when none selected", () => {
		render(Checklist, { props: { items: testItems } });

		const selectAll = screen.getByTestId("select-all") as HTMLInputElement;

		// When none selected, indeterminate should be false
		expect(selectAll.indeterminate).toBe(false);
		expect(selectAll).not.toBeChecked();
	});

	test("select all not indeterminate when all selected - verify indeterminate is false when all selected", async () => {
		const user = userEvent.setup();
		render(Checklist, { props: { items: testItems } });

		const selectAll = screen.getByTestId("select-all") as HTMLInputElement;

		// Select all items
		await user.click(selectAll);

		// When all selected, indeterminate should be false and checked should be true
		expect(selectAll.indeterminate).toBe(false);
		expect(selectAll).toBeChecked();
	});
});
