import { render, screen, act } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { tick } from "svelte";
import Timer from "./Component.svelte";

describe("Timer component", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("displays initial time as 00:00.00", () => {
		render(Timer);

		const display = screen.getByTestId("display");
		expect(display).toHaveTextContent("00:00.00");
	});

	test("start begins counting - click start, advance time, verify display shows elapsed time", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		const startButton = screen.getByTestId("start");
		await user.click(startButton);

		// Advance time by 1.5 seconds and wait for Svelte to update
		await act(async () => {
			vi.advanceTimersByTime(1500);
			await tick();
		});

		const display = screen.getByTestId("display");
		expect(display).toHaveTextContent("00:01.50");
	});

	test("pause stops counting - start, advance time, pause, advance more time, verify display didn't change", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		// Start timer
		const startButton = screen.getByTestId("start");
		await user.click(startButton);

		// Advance time by 1 second
		await act(async () => {
			vi.advanceTimersByTime(1000);
			await tick();
		});

		// Pause timer
		const pauseButton = screen.getByTestId("pause");
		await user.click(pauseButton);

		const displayAfterPause = screen.getByTestId("display").textContent;

		// Advance more time
		await act(async () => {
			vi.advanceTimersByTime(2000);
			await tick();
		});

		// Display should not have changed
		expect(screen.getByTestId("display")).toHaveTextContent(displayAfterPause!);
	});

	test("reset clears timer - start, advance, reset, verify display shows 00:00.00", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		// Start timer
		const startButton = screen.getByTestId("start");
		await user.click(startButton);

		// Advance time
		await act(async () => {
			vi.advanceTimersByTime(5000);
			await tick();
		});

		// Reset timer
		const resetButton = screen.getByTestId("reset");
		await user.click(resetButton);

		const display = screen.getByTestId("display");
		expect(display).toHaveTextContent("00:00.00");
	});

	test("lap records current time - start, advance, click lap, verify lap time is recorded", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		// Start timer
		const startButton = screen.getByTestId("start");
		await user.click(startButton);

		// Advance time by 2.5 seconds
		await act(async () => {
			vi.advanceTimersByTime(2500);
			await tick();
		});

		// Record lap
		const lapButton = screen.getByTestId("lap");
		await user.click(lapButton);

		// Verify lap is recorded
		const lapItem = screen.getByTestId("lap-0");
		expect(lapItem).toHaveTextContent("00:02.50");
	});

	test("display format is MM:SS.ms - verify format for over a minute", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		// Start timer
		const startButton = screen.getByTestId("start");
		await user.click(startButton);

		// Advance time by 1 minute and 30.25 seconds
		await act(async () => {
			vi.advanceTimersByTime(90250);
			await tick();
		});

		const display = screen.getByTestId("display");
		expect(display).toHaveTextContent("01:30.25");
	});

	test("multiple laps are recorded correctly", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		// Start timer
		const startButton = screen.getByTestId("start");
		await user.click(startButton);

		// First lap at 1 second
		await act(async () => {
			vi.advanceTimersByTime(1000);
			await tick();
		});
		const lapButton = screen.getByTestId("lap");
		await user.click(lapButton);

		// Second lap at 2.5 seconds total
		await act(async () => {
			vi.advanceTimersByTime(1500);
			await tick();
		});
		await user.click(lapButton);

		// Verify both laps
		expect(screen.getByTestId("lap-0")).toHaveTextContent("00:01.00");
		expect(screen.getByTestId("lap-1")).toHaveTextContent("00:02.50");
	});

	test("reset clears laps", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(Timer);

		// Start timer and record a lap
		const startButton = screen.getByTestId("start");
		await user.click(startButton);
		
		await act(async () => {
			vi.advanceTimersByTime(1000);
			await tick();
		});

		const lapButton = screen.getByTestId("lap");
		await user.click(lapButton);

		// Verify lap exists
		expect(screen.getByTestId("lap-0")).toBeInTheDocument();

		// Reset
		const resetButton = screen.getByTestId("reset");
		await user.click(resetButton);

		// Verify laps are cleared
		expect(screen.queryByTestId("lap-0")).not.toBeInTheDocument();
	});
});
