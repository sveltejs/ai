import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import TemperatureConverter from "./Component.svelte";

describe("TemperatureConverter component", () => {
	test("Celsius to Fahrenheit - enter 0 Celsius, verify Fahrenheit shows 32", async () => {
		const user = userEvent.setup();
		render(TemperatureConverter);

		const celsiusInput = screen.getByTestId("celsius-input");
		const fahrenheitInput = screen.getByTestId("fahrenheit-input");

		// Clear and enter 0 in Celsius
		await user.clear(celsiusInput);
		await user.type(celsiusInput, "0");

		// Fahrenheit should show 32
		expect(fahrenheitInput).toHaveValue(32);
	});

	test("Fahrenheit to Celsius - enter 212 Fahrenheit, verify Celsius shows 100", async () => {
		const user = userEvent.setup();
		render(TemperatureConverter);

		const celsiusInput = screen.getByTestId("celsius-input");
		const fahrenheitInput = screen.getByTestId("fahrenheit-input");

		// Clear and enter 212 in Fahrenheit
		await user.clear(fahrenheitInput);
		await user.type(fahrenheitInput, "212");

		// Celsius should show 100
		expect(celsiusInput).toHaveValue(100);
	});

	test("Celsius to Kelvin - enter 0 Celsius, verify Kelvin shows 273.15", async () => {
		const user = userEvent.setup();
		render(TemperatureConverter);

		const celsiusInput = screen.getByTestId("celsius-input");
		const kelvinInput = screen.getByTestId("kelvin-input");

		// Clear and enter 0 in Celsius
		await user.clear(celsiusInput);
		await user.type(celsiusInput, "0");

		// Kelvin should show 273.15
		expect(kelvinInput).toHaveValue(273.15);
	});

	test("Kelvin to Celsius - enter 373.15 Kelvin, verify Celsius shows 100", async () => {
		const user = userEvent.setup();
		render(TemperatureConverter);

		const celsiusInput = screen.getByTestId("celsius-input");
		const kelvinInput = screen.getByTestId("kelvin-input");

		// Clear and enter 373.15 in Kelvin
		await user.clear(kelvinInput);
		await user.type(kelvinInput, "373.15");

		// Celsius should show 100
		expect(celsiusInput).toHaveValue(100);
	});

	test("All fields update together - enter value in one, verify other two update", async () => {
		const user = userEvent.setup();
		render(TemperatureConverter);

		const celsiusInput = screen.getByTestId("celsius-input");
		const fahrenheitInput = screen.getByTestId("fahrenheit-input");
		const kelvinInput = screen.getByTestId("kelvin-input");

		// Enter 100 in Celsius
		await user.clear(celsiusInput);
		await user.type(celsiusInput, "100");

		// Verify both Fahrenheit and Kelvin update
		expect(fahrenheitInput).toHaveValue(212);
		expect(kelvinInput).toHaveValue(373.15);
	});

	test("Handles decimals - enter decimal value, verify reasonable precision in outputs", async () => {
		const user = userEvent.setup();
		render(TemperatureConverter);

		const celsiusInput = screen.getByTestId("celsius-input");
		const fahrenheitInput = screen.getByTestId("fahrenheit-input");
		const kelvinInput = screen.getByTestId("kelvin-input");

		// Enter 25.5 in Celsius
		await user.clear(celsiusInput);
		await user.type(celsiusInput, "25.5");

		// Fahrenheit should be 77.9 (25.5 * 9/5 + 32 = 77.9)
		expect(fahrenheitInput).toHaveValue(77.9);

		// Kelvin should be 298.65 (25.5 + 273.15 = 298.65)
		expect(kelvinInput).toHaveValue(298.65);
	});
});
