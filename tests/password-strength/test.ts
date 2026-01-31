import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import PasswordStrength from "./Component.svelte";

describe("PasswordStrength component", () => {
	test("weak password shows weak - enter 'abc', verify 'weak' is shown", async () => {
		const user = userEvent.setup();
		render(PasswordStrength);

		const input = screen.getByTestId("password-input");
		await user.type(input, "abc");

		const strengthValue = screen.getByTestId("strength-value");
		expect(strengthValue).toHaveTextContent("weak");
	});

	test("criteria updates on input - enter 'Password1!', verify uppercase, lowercase, number criteria are met", async () => {
		const user = userEvent.setup();
		render(PasswordStrength);

		const input = screen.getByTestId("password-input");
		await user.type(input, "Password1!");

		// Check that uppercase, lowercase, and number criteria are met
		const uppercaseCriteria = screen.getByTestId("criteria-uppercase");
		const lowercaseCriteria = screen.getByTestId("criteria-lowercase");
		const numberCriteria = screen.getByTestId("criteria-number");
		const specialCriteria = screen.getByTestId("criteria-special");

		expect(uppercaseCriteria).toHaveClass("met");
		expect(lowercaseCriteria).toHaveClass("met");
		expect(numberCriteria).toHaveClass("met");
		expect(specialCriteria).toHaveClass("met");
	});

	test("show button reveals password - verify input type changes from 'password' to 'text'", async () => {
		const user = userEvent.setup();
		render(PasswordStrength);

		const input = screen.getByTestId("password-input");
		const toggleButton = screen.getByTestId("toggle-visibility");

		// Initial state - password should be hidden
		expect(input).toHaveAttribute("type", "password");

		// Click the toggle button
		await user.click(toggleButton);

		// Password should now be visible
		expect(input).toHaveAttribute("type", "text");
	});

	test("strong password shows strong - enter a password meeting all criteria, verify strength indicator", async () => {
		const user = userEvent.setup();
		render(PasswordStrength);

		const input = screen.getByTestId("password-input");
		// Password meeting all 5 criteria: length>=8, uppercase, lowercase, number, special
		await user.type(input, "Password1!");

		const strengthValue = screen.getByTestId("strength-value");
		expect(strengthValue).toHaveTextContent("very strong");
	});

	test("all criteria start unchecked - render with no input, verify no criteria are met", () => {
		render(PasswordStrength);

		const lengthCriteria = screen.getByTestId("criteria-length");
		const uppercaseCriteria = screen.getByTestId("criteria-uppercase");
		const lowercaseCriteria = screen.getByTestId("criteria-lowercase");
		const numberCriteria = screen.getByTestId("criteria-number");
		const specialCriteria = screen.getByTestId("criteria-special");

		expect(lengthCriteria).not.toHaveClass("met");
		expect(uppercaseCriteria).not.toHaveClass("met");
		expect(lowercaseCriteria).not.toHaveClass("met");
		expect(numberCriteria).not.toHaveClass("met");
		expect(specialCriteria).not.toHaveClass("met");
	});

	test("length criteria works - enter 8+ characters, verify length criteria is met", async () => {
		const user = userEvent.setup();
		render(PasswordStrength);

		const input = screen.getByTestId("password-input");
		const lengthCriteria = screen.getByTestId("criteria-length");

		// Type less than 8 characters
		await user.type(input, "1234567");
		expect(lengthCriteria).not.toHaveClass("met");

		// Type one more character to reach 8
		await user.type(input, "8");
		expect(lengthCriteria).toHaveClass("met");
	});
});
