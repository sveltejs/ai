import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import FormWizard from "./Component.svelte";

const testSteps = [
	{
		title: "Step 1: Personal Info",
		fields: [
			{ name: "name", label: "Full Name", required: true },
			{ name: "email", label: "Email", required: true },
		],
	},
	{
		title: "Step 2: Address",
		fields: [
			{ name: "street", label: "Street Address", required: true },
			{ name: "city", label: "City", required: false },
		],
	},
	{
		title: "Step 3: Review",
		fields: [{ name: "notes", label: "Additional Notes", required: false }],
	},
];

describe("FormWizard component", () => {
	test("shows first step initially - verify Step 1 title is shown", () => {
		render(FormWizard, { props: { steps: testSteps } });

		// First step title should be visible
		expect(screen.getByTestId("step-title")).toHaveTextContent("Step 1: Personal Info");

		// First step fields should be visible
		expect(screen.getByTestId("field-name")).toBeInTheDocument();
		expect(screen.getByTestId("field-email")).toBeInTheDocument();
	});

	test("next advances step - fill required fields, click next, verify step 2 shown", async () => {
		const user = userEvent.setup();
		render(FormWizard, { props: { steps: testSteps } });

		// Fill required fields for step 1
		const nameInput = screen.getByTestId("input-name");
		const emailInput = screen.getByTestId("input-email");
		await user.type(nameInput, "John Doe");
		await user.type(emailInput, "john@example.com");

		// Click next
		const nextButton = screen.getByTestId("next-button");
		await user.click(nextButton);

		// Should now be on step 2
		expect(screen.getByTestId("step-title")).toHaveTextContent("Step 2: Address");
		expect(screen.getByTestId("field-street")).toBeInTheDocument();
	});

	test("validation prevents advance - click next without filling required fields, verify error and still on step 1", async () => {
		const user = userEvent.setup();
		render(FormWizard, { props: { steps: testSteps } });

		// Click next without filling required fields
		const nextButton = screen.getByTestId("next-button");
		await user.click(nextButton);

		// Should still be on step 1
		expect(screen.getByTestId("step-title")).toHaveTextContent("Step 1: Personal Info");

		// Error should be shown
		expect(screen.getByTestId("error-name")).toBeInTheDocument();
	});

	test("previous goes back - go to step 2, click previous, verify back on step 1", async () => {
		const user = userEvent.setup();
		render(FormWizard, { props: { steps: testSteps } });

		// Fill required fields and advance to step 2
		const nameInput = screen.getByTestId("input-name");
		const emailInput = screen.getByTestId("input-email");
		await user.type(nameInput, "John Doe");
		await user.type(emailInput, "john@example.com");

		const nextButton = screen.getByTestId("next-button");
		await user.click(nextButton);

		// Verify on step 2
		expect(screen.getByTestId("step-title")).toHaveTextContent("Step 2: Address");

		// Click previous
		const prevButton = screen.getByTestId("prev-button");
		await user.click(prevButton);

		// Should be back on step 1
		expect(screen.getByTestId("step-title")).toHaveTextContent("Step 1: Personal Info");
	});

	test("previous disabled on first step - verify previous button is disabled on step 1", () => {
		render(FormWizard, { props: { steps: testSteps } });

		const prevButton = screen.getByTestId("prev-button");
		expect(prevButton).toBeDisabled();
	});

	test("submit shown on last step - navigate to last step, verify submit button instead of next", async () => {
		const user = userEvent.setup();
		render(FormWizard, { props: { steps: testSteps } });

		// Fill step 1 and advance
		await user.type(screen.getByTestId("input-name"), "John Doe");
		await user.type(screen.getByTestId("input-email"), "john@example.com");
		await user.click(screen.getByTestId("next-button"));

		// Fill step 2 and advance
		await user.type(screen.getByTestId("input-street"), "123 Main St");
		await user.click(screen.getByTestId("next-button"));

		// Should be on last step
		expect(screen.getByTestId("step-title")).toHaveTextContent("Step 3: Review");

		// Should show submit button instead of next
		expect(screen.queryByTestId("next-button")).toBeNull();
		expect(screen.getByTestId("submit-button")).toBeInTheDocument();
	});

	test("step indicator shows current - verify visual indicator of current step", () => {
		render(FormWizard, { props: { steps: testSteps } });

		// Step indicator should show current position
		const indicator = screen.getByTestId("step-indicator");
		expect(indicator).toHaveTextContent(/1.*3/);
	});
});
