import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import Toggle from "./Component.svelte";

describe("Toggle component", () => {
	test("clicking toggles state - render with checked=false, click, verify aria-checked is true", async () => {
		const user = userEvent.setup();
		render(Toggle, { props: { checked: false, label: "Test toggle" } });

		const switchElement = screen.getByTestId("switch");

		// Initial state should be unchecked
		expect(switchElement).toHaveAttribute("aria-checked", "false");

		// Click the switch
		await user.click(switchElement);

		// Should now be checked
		expect(switchElement).toHaveAttribute("aria-checked", "true");
	});

	test("Space key toggles - render with checked=false, press Space, verify toggled", async () => {
		const user = userEvent.setup();
		render(Toggle, { props: { checked: false, label: "Test toggle" } });

		const switchElement = screen.getByTestId("switch");

		// Initial state should be unchecked
		expect(switchElement).toHaveAttribute("aria-checked", "false");

		// Focus and press Space
		switchElement.focus();
		await user.keyboard(" ");

		// Should now be checked
		expect(switchElement).toHaveAttribute("aria-checked", "true");
	});

	test("Enter key toggles - render with checked=false, press Enter, verify toggled", async () => {
		const user = userEvent.setup();
		render(Toggle, { props: { checked: false, label: "Test toggle" } });

		const switchElement = screen.getByTestId("switch");

		// Initial state should be unchecked
		expect(switchElement).toHaveAttribute("aria-checked", "false");

		// Focus and press Enter
		switchElement.focus();
		await user.keyboard("{Enter}");

		// Should now be checked
		expect(switchElement).toHaveAttribute("aria-checked", "true");
	});

	test("disabled prevents toggle - render with disabled=true, click, verify state unchanged", async () => {
		const user = userEvent.setup();
		render(Toggle, { props: { checked: false, disabled: true, label: "Test toggle" } });

		const switchElement = screen.getByTestId("switch");

		// Initial state should be unchecked
		expect(switchElement).toHaveAttribute("aria-checked", "false");

		// Try to click the disabled switch
		await user.click(switchElement);

		// State should remain unchanged
		expect(switchElement).toHaveAttribute("aria-checked", "false");
	});

	test("label is associated - verify the label is properly connected to the switch", () => {
		render(Toggle, { props: { label: "My Toggle Label" } });

		const labelElement = screen.getByTestId("label");
		const switchElement = screen.getByTestId("switch");

		// Label should be visible
		expect(labelElement).toHaveTextContent("My Toggle Label");

		// Switch should have aria-labelledby pointing to the label
		const labelId = labelElement.getAttribute("id");
		expect(switchElement).toHaveAttribute("aria-labelledby", labelId);
	});

	test("aria-checked reflects state - verify aria-checked attribute matches internal state", async () => {
		const user = userEvent.setup();
		render(Toggle, { props: { checked: true, label: "Test toggle" } });

		const switchElement = screen.getByTestId("switch");

		// Initial state should be checked (passed as prop)
		expect(switchElement).toHaveAttribute("aria-checked", "true");

		// Click to toggle off
		await user.click(switchElement);

		// Should now be unchecked
		expect(switchElement).toHaveAttribute("aria-checked", "false");

		// Click again to toggle on
		await user.click(switchElement);

		// Should be checked again
		expect(switchElement).toHaveAttribute("aria-checked", "true");
	});
});
