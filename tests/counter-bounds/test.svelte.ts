import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import Counter from "./Component.svelte";
import { flushSync } from "svelte";

describe("Counter with bounds component", () => {
  test("increment increases count", async () => {
    const user = userEvent.setup();
    render(Counter, { props: { initialValue: 0 } });

    const incrementButton = screen.getByTestId("increment-button");
    const countElement = screen.getByTestId("count-value");

    expect(countElement).toHaveTextContent("0");

    await user.click(incrementButton);

    expect(countElement).toHaveTextContent("1");
  });

  test("decrement decreases count", async () => {
    const user = userEvent.setup();
    render(Counter, { props: { initialValue: 5 } });

    const decrementButton = screen.getByTestId("decrement-button");
    const countElement = screen.getByTestId("count-value");

    expect(countElement).toHaveTextContent("5");

    await user.click(decrementButton);

    expect(countElement).toHaveTextContent("4");
  });

  test("increment disabled at max", () => {
    render(Counter, { props: { initialValue: 10, max: 10 } });

    const incrementButton = screen.getByTestId("increment-button");

    expect(incrementButton).toBeDisabled();
  });

  test("decrement disabled at min", () => {
    render(Counter, { props: { initialValue: 0, min: 0 } });

    const decrementButton = screen.getByTestId("decrement-button");

    expect(decrementButton).toBeDisabled();
  });

  test("reset returns to initial value", async () => {
    const user = userEvent.setup();
    render(Counter, { props: { initialValue: 5 } });

    const incrementButton = screen.getByTestId("increment-button");
    const resetButton = screen.getByTestId("reset-button");
    const countElement = screen.getByTestId("count-value");

    expect(countElement).toHaveTextContent("5");

    await user.click(incrementButton);
    expect(countElement).toHaveTextContent("6");

    await user.click(resetButton);
    expect(countElement).toHaveTextContent("5");
  });

  test("defaults work without bounds - no buttons disabled", () => {
    render(Counter, { props: { initialValue: 0 } });

    const incrementButton = screen.getByTestId("increment-button");
    const decrementButton = screen.getByTestId("decrement-button");

    expect(incrementButton).not.toBeDisabled();
    expect(decrementButton).not.toBeDisabled();
  });

  test("works if the initialValue prop changes", async () => {
    const user = userEvent.setup();
	let props = $state({ initialValue: 0 });
    render(Counter, { props });

    const incrementButton = screen.getByTestId("increment-button");
	await user.click(incrementButton);
	const countElement = screen.getByTestId("count-value");
	expect(countElement).toHaveTextContent("1");
	flushSync(()=>{
		props.initialValue = 10;
	})
	expect(countElement).toHaveTextContent("10");
  });
});
