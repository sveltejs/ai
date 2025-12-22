import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import Counter from "./Component.svelte";

describe("Counter component with reactive class", () => {
  test("renders with initial count of 0", () => {
    render(Counter);

    const countElement = screen.getByTestId("count-value");
    expect(countElement).toHaveTextContent("0");
  });

  test("increments count when + is clicked", async () => {
    const user = userEvent.setup();
    render(Counter);

    const incrementButton = screen.getByTestId("increment-button");
    const countElement = screen.getByTestId("count-value");

    await user.click(incrementButton);
    expect(countElement).toHaveTextContent("1");

    await user.click(incrementButton);
    expect(countElement).toHaveTextContent("2");
  });

  test("decrements count when - is clicked", async () => {
    const user = userEvent.setup();
    render(Counter);

    const decrementButton = screen.getByTestId("decrement-button");
    const countElement = screen.getByTestId("count-value");

    await user.click(decrementButton);
    expect(countElement).toHaveTextContent("-1");

    await user.click(decrementButton);
    expect(countElement).toHaveTextContent("-2");
  });

  test("resets count when reset is clicked", async () => {
    const user = userEvent.setup();
    render(Counter);

    const incrementButton = screen.getByTestId("increment-button");
    const resetButton = screen.getByTestId("reset-button");
    const countElement = screen.getByTestId("count-value");

    // Increment a few times
    await user.click(incrementButton);
    await user.click(incrementButton);
    await user.click(incrementButton);
    expect(countElement).toHaveTextContent("3");

    // Reset
    await user.click(resetButton);
    expect(countElement).toHaveTextContent("0");
  });

  test("reset works after decrementing", async () => {
    const user = userEvent.setup();
    render(Counter);

    const decrementButton = screen.getByTestId("decrement-button");
    const resetButton = screen.getByTestId("reset-button");
    const countElement = screen.getByTestId("count-value");

    // Decrement
    await user.click(decrementButton);
    await user.click(decrementButton);
    expect(countElement).toHaveTextContent("-2");

    // Reset should go back to 0
    await user.click(resetButton);
    expect(countElement).toHaveTextContent("0");
  });

  test("all buttons are present", () => {
    render(Counter);

    expect(screen.getByTestId("increment-button")).toBeInTheDocument();
    expect(screen.getByTestId("decrement-button")).toBeInTheDocument();
    expect(screen.getByTestId("reset-button")).toBeInTheDocument();
    expect(screen.getByTestId("count-value")).toBeInTheDocument();
  });
});
