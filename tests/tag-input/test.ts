import { render, screen, fireEvent } from "@testing-library/svelte";
import { expect, test, describe } from "vitest";
import userEvent from "@testing-library/user-event";
import TagInput from "./Component.svelte";

describe("TagInput component", () => {
	test("Enter adds tag - type 'tag1', press Enter, verify tag appears", async () => {
		const user = userEvent.setup();
		render(TagInput);

		const input = screen.getByTestId("tag-input");

		await user.type(input, "tag1");
		await user.keyboard("{Enter}");

		const tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(1);
		expect(screen.getByTestId("tag-text")).toHaveTextContent("tag1");
	});

	test("Comma adds tag - type 'tag1,', verify tag appears", async () => {
		const user = userEvent.setup();
		render(TagInput);

		const input = screen.getByTestId("tag-input");

		await user.type(input, "tag1,");

		const tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(1);
		expect(screen.getByTestId("tag-text")).toHaveTextContent("tag1");
	});

	test("X removes tag - click X button, verify tag gone", async () => {
		const user = userEvent.setup();
		render(TagInput);

		const input = screen.getByTestId("tag-input");
		await user.type(input, "tag1{Enter}");

		// Verify tag exists
		expect(screen.getByTestId("tag")).toBeInTheDocument();
		expect(screen.getByTestId("tag-text")).toHaveTextContent("tag1");

		// Click remove button
		const removeButton = screen.getByTestId("remove-tag-button");
		await user.click(removeButton);

		// Verify tag is gone
		expect(screen.queryByTestId("tag")).not.toBeInTheDocument();
	});

	test("Backspace removes last tag - render with tags, focus empty input, press Backspace, verify last tag removed", async () => {
		const user = userEvent.setup();
		render(TagInput);

		const input = screen.getByTestId("tag-input");
		await user.type(input, "tag1{Enter}tag2{Enter}");


		// Verify both tags exist
		let tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(2);

		await user.click(input);
		await user.keyboard("{Backspace}");

		// Verify last tag was removed
		tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(1);
		expect(screen.getByTestId("tag-text")).toHaveTextContent("tag1");
	});

	test("Respects maxTags - render with maxTags=2, try adding 'c', verify not added", async () => {
		const user = userEvent.setup();
		render(TagInput, {
			props: {
				maxTags: 2,
			},
		});

		const input = screen.getByTestId("tag-input");
		await user.type(input, "a{Enter}b{Enter}");


		// Verify initial tags
		let tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(2);

		// Input should be disabled when at max
		expect(input).toBeDisabled();

		// Even if we try to type, nothing should happen
		// (the input is disabled so this won't actually type)
		await user.type(input, "c{Enter}").catch(() => {
			// Expected - can't type in disabled input
		});

		// Verify still only 2 tags
		tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(2);
	});

	test("Duplicates blocked by default - try adding 'tag1' again, verify not added", async () => {
		const user = userEvent.setup();
		render(TagInput);

		const input = screen.getByTestId("tag-input");
		await user.type(input, "tag1{Enter}");


		// Verify initial tag
		let tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(1);

		// Try to add duplicate
		await user.type(input, "tag1{Enter}");

		// Verify still only 1 tag
		tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(1);
	});

	test("Duplicates allowed when enabled - render with allowDuplicates=true, add same tag twice, verify both exist", async () => {
		const user = userEvent.setup();
		render(TagInput, {
			props: {
				allowDuplicates: true,
			},
		});

		const input = screen.getByTestId("tag-input");

		// Add same tag twice
		await user.type(input, "tag1{Enter}");
		await user.type(input, "tag1{Enter}");

		// Verify both tags exist
		const tags = screen.getAllByTestId("tag");
		expect(tags.length).toBe(2);

		const tagTexts = screen.getAllByTestId("tag-text");
		expect(tagTexts[0]).toHaveTextContent("tag1");
		expect(tagTexts[1]).toHaveTextContent("tag1");
	});
});
