import { render, screen } from "@testing-library/svelte";
import { expect, test, describe, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import Button from "./Component.svelte";

describe("Button with Variants component", () => {
  test("applies variant class", () => {
    render(Button, { props: { variant: "primary" } });

    const button = screen.getByRole("button");
    expect(button).toHaveClass("primary");
  });

  test("applies size class", () => {
    render(Button, { props: { size: "lg" } });

    const button = screen.getByRole("button");
    expect(button).toHaveClass("lg");
  });

  test("disabled prevents click", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(Button, { props: { disabled: true, onclick: handleClick } });

    const button = screen.getByRole("button");
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  test("click event forwarded", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(Button, { props: { onclick: handleClick } });

    const button = screen.getByRole("button");
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("default props work", () => {
    render(Button);

    const button = screen.getByRole("button");
    // Default variant is primary
    expect(button).toHaveClass("primary");
    // Default size is md
    expect(button).toHaveClass("md");
    // Button should not be disabled by default
    expect(button).not.toBeDisabled();
  });
});
