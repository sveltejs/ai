import { render, screen } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import Card from "./Component.svelte";

// Helper component that uses the Card with children content
import CardWithChildren from "./CardWithChildren.test.svelte";
import CardWithHeader from "./CardWithHeader.test.svelte";
import CardWithoutHeader from "./CardWithoutHeader.test.svelte";

describe("Card component with children snippet", () => {
  test("renders children content", () => {
    render(CardWithChildren);

    const card = screen.getByTestId("card");
    const content = screen.getByTestId("card-content");

    expect(card).toBeInTheDocument();
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Hello World");
  });

  test("renders header when provided", () => {
    render(CardWithHeader);

    const header = screen.getByTestId("card-header");
    const content = screen.getByTestId("card-content");

    expect(header).toBeInTheDocument();
    expect(header).toHaveTextContent("Card Title");
    expect(content).toHaveTextContent("Card body content");
  });

  test("does not render header when not provided", () => {
    render(CardWithoutHeader);

    const header = screen.queryByTestId("card-header");
    const content = screen.getByTestId("card-content");

    expect(header).not.toBeInTheDocument();
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Just content");
  });

  test("renders multiple children elements", () => {
    render(CardWithChildren);

    const content = screen.getByTestId("card-content");
    expect(content.querySelector("p")).toBeInTheDocument();
    expect(content.querySelector("span")).toBeInTheDocument();
  });
});
