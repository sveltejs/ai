import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import Tabs from "./Component.svelte";

const testTabs = [
	{ label: "Tab 1", content: "Content for tab 1" },
	{ label: "Tab 2", content: "Content for tab 2" },
	{ label: "Tab 3", content: "Content for tab 3" },
];

describe("Tabs component", () => {
	test("clicking tab shows content - render with tabs, click second tab, verify its content is shown", async () => {
		const user = userEvent.setup();
		render(Tabs, { props: { tabs: testTabs } });

		// Click the second tab
		const tabs = screen.getAllByTestId("tab");
		const secondTab = tabs[1];
		expect(secondTab).toBeDefined();
		await user.click(secondTab!);

		// Second tab's content should now be visible
		const panel = screen.getByTestId("tabpanel");
		expect(panel).toBeInTheDocument();
		expect(panel).toHaveTextContent("Content for tab 2");
	});

	test("first tab is active by default - render, verify first tab content is visible", () => {
		render(Tabs, { props: { tabs: testTabs } });

		// First tab content should be visible by default
		const panel = screen.getByTestId("tabpanel");
		expect(panel).toBeInTheDocument();
		expect(panel).toHaveTextContent("Content for tab 1");

		// First tab should have aria-selected="true"
		const tabs = screen.getAllByTestId("tab");
		expect(tabs[0]).toHaveAttribute("aria-selected", "true");
		expect(tabs[1]).toHaveAttribute("aria-selected", "false");
		expect(tabs[2]).toHaveAttribute("aria-selected", "false");
	});

	test("arrow right navigates to next tab - focus on first tab, press ArrowRight, verify second tab has focus", async () => {
		const user = userEvent.setup();
		render(Tabs, { props: { tabs: testTabs } });

		const tabs = screen.getAllByTestId("tab");
		const firstTab = tabs[0];
		const secondTab = tabs[1];
		expect(firstTab).toBeDefined();
		expect(secondTab).toBeDefined();

		// Focus on the first tab
		firstTab!.focus();
		expect(document.activeElement).toBe(firstTab);

		// Press ArrowRight
		await user.keyboard("{ArrowRight}");

		// Second tab should now have focus
		expect(document.activeElement).toBe(secondTab);
	});

	test("arrow left navigates to previous tab - focus on second tab, press ArrowLeft, verify first tab has focus", async () => {
		const user = userEvent.setup();
		render(Tabs, { props: { tabs: testTabs } });

		const tabs = screen.getAllByTestId("tab");
		const firstTab = tabs[0];
		const secondTab = tabs[1];
		expect(firstTab).toBeDefined();
		expect(secondTab).toBeDefined();

		// Click second tab to activate it, then focus
		await user.click(secondTab!);
		secondTab!.focus();
		expect(document.activeElement).toBe(secondTab);

		// Press ArrowLeft
		await user.keyboard("{ArrowLeft}");

		// First tab should now have focus
		expect(document.activeElement).toBe(firstTab);
	});

	test("proper ARIA roles - verify tablist role on container, tab role on buttons, tabpanel role on content", () => {
		render(Tabs, { props: { tabs: testTabs } });

		// Verify tablist role on container
		const tablist = screen.getByTestId("tablist");
		expect(tablist).toHaveAttribute("role", "tablist");

		// Verify tab role on buttons
		const tabs = screen.getAllByTestId("tab");
		tabs.forEach((tab) => {
			expect(tab).toHaveAttribute("role", "tab");
		});

		// Verify tabpanel role on content
		const panel = screen.getByTestId("tabpanel");
		expect(panel).toHaveAttribute("role", "tabpanel");
	});

	test("arrow navigation wraps around - last tab ArrowRight goes to first, first tab ArrowLeft goes to last", async () => {
		const user = userEvent.setup();
		render(Tabs, { props: { tabs: testTabs } });

		const tabs = screen.getAllByTestId("tab");
		const firstTab = tabs[0];
		const lastTab = tabs[2];
		expect(firstTab).toBeDefined();
		expect(lastTab).toBeDefined();

		// Click and focus on last tab
		await user.click(lastTab!);
		lastTab!.focus();
		expect(document.activeElement).toBe(lastTab);

		// Press ArrowRight - should wrap to first tab
		await user.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(firstTab);

		// Press ArrowLeft - should wrap back to last tab
		await user.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(lastTab);
	});

	test("tabs have proper aria-controls and tabpanel has matching id", () => {
		render(Tabs, { props: { tabs: testTabs } });

		const tabs = screen.getAllByTestId("tab");
		const panel = screen.getByTestId("tabpanel");

		// First tab should have aria-controls pointing to the panel
		const ariaControls = tabs[0]!.getAttribute("aria-controls");
		expect(ariaControls).toBeTruthy();
		expect(panel).toHaveAttribute("id", ariaControls);
	});

	test("inactive tabs have tabindex -1, active tab has tabindex 0", () => {
		render(Tabs, { props: { tabs: testTabs } });

		const tabs = screen.getAllByTestId("tab");

		// First tab (active) should have tabindex 0
		expect(tabs[0]).toHaveAttribute("tabindex", "0");

		// Other tabs should have tabindex -1
		expect(tabs[1]).toHaveAttribute("tabindex", "-1");
		expect(tabs[2]).toHaveAttribute("tabindex", "-1");
	});
});
