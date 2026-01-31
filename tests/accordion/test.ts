import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import Accordion from "./Component.svelte";

const testItems = [
	{ title: "Section 1", content: "Content for section 1" },
	{ title: "Section 2", content: "Content for section 2" },
	{ title: "Section 3", content: "Content for section 3" },
];

describe("Accordion component", () => {
	test("clicking opens section - content becomes visible", async () => {
		const user = userEvent.setup();
		render(Accordion, { props: { items: testItems } });

		// Initially no panels should be visible
		expect(screen.queryByTestId("accordion-panel")).not.toBeInTheDocument();

		// Click the first section title
		const buttons = screen.getAllByTestId("accordion-button");
		const firstButton = buttons[0];
		expect(firstButton).toBeDefined();
		await user.click(firstButton!);

		// Content should now be visible
		const panel = screen.getByTestId("accordion-panel");
		expect(panel).toBeInTheDocument();
		expect(panel).toHaveTextContent("Content for section 1");
	});

	test("clicking again closes section - content hides", async () => {
		const user = userEvent.setup();
		render(Accordion, { props: { items: testItems } });

		const buttons = screen.getAllByTestId("accordion-button");
		const firstButton = buttons[0];
		expect(firstButton).toBeDefined();

		// Open the section
		await user.click(firstButton!);
		expect(screen.getByTestId("accordion-panel")).toBeInTheDocument();

		// Click again to close
		await user.click(firstButton!);
		expect(screen.queryByTestId("accordion-panel")).not.toBeInTheDocument();
	});

	test("single mode closes others - opening one section closes previously open one", async () => {
		const user = userEvent.setup();
		render(Accordion, { props: { items: testItems, single: true } });

		const buttons = screen.getAllByTestId("accordion-button");
		const firstButton = buttons[0];
		const secondButton = buttons[1];
		expect(firstButton).toBeDefined();
		expect(secondButton).toBeDefined();

		// Open first section
		await user.click(firstButton!);
		let panels = screen.getAllByTestId("accordion-panel");
		expect(panels.length).toBe(1);
		expect(panels[0]).toHaveTextContent("Content for section 1");

		// Open second section - first should close
		await user.click(secondButton!);
		panels = screen.getAllByTestId("accordion-panel");
		expect(panels.length).toBe(1);
		expect(panels[0]).toHaveTextContent("Content for section 2");
	});

	test("multiple sections can be open in default mode", async () => {
		const user = userEvent.setup();
		render(Accordion, { props: { items: testItems, single: false } });

		const buttons = screen.getAllByTestId("accordion-button");
		const firstButton = buttons[0];
		const secondButton = buttons[1];
		expect(firstButton).toBeDefined();
		expect(secondButton).toBeDefined();

		// Open first section
		await user.click(firstButton!);
		expect(screen.getAllByTestId("accordion-panel").length).toBe(1);

		// Open second section - first should remain open
		await user.click(secondButton!);
		const panels = screen.getAllByTestId("accordion-panel");
		expect(panels.length).toBe(2);
		expect(panels[0]).toHaveTextContent("Content for section 1");
		expect(panels[1]).toHaveTextContent("Content for section 2");
	});

	test("ARIA attributes present - aria-expanded on buttons", async () => {
		const user = userEvent.setup();
		render(Accordion, { props: { items: testItems } });

		const buttons = screen.getAllByTestId("accordion-button");
		expect(buttons.length).toBe(3);
		const firstButton = buttons[0];
		const secondButton = buttons[1];
		const thirdButton = buttons[2];
		expect(firstButton).toBeDefined();
		expect(secondButton).toBeDefined();
		expect(thirdButton).toBeDefined();

		// Initially all buttons should have aria-expanded="false"
		buttons.forEach((button) => {
			expect(button).toHaveAttribute("aria-expanded", "false");
		});

		// Open first section
		await user.click(firstButton!);

		// First button should now have aria-expanded="true"
		expect(firstButton).toHaveAttribute("aria-expanded", "true");
		// Others should still be false
		expect(secondButton).toHaveAttribute("aria-expanded", "false");
		expect(thirdButton).toHaveAttribute("aria-expanded", "false");
	});
});
