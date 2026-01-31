# Svelte 5 Agent Benchmark Test Suite

A collection of isolated, testable tasks for evaluating AI agents' Svelte 5 code generation.

Each test case includes:

- **Description**: Component requirements
- **Agent Prompt**: Exact prompt to give
- **Testing Strategy**: Vitest test examples
- **Validation**: Svelte 5 patterns to verify

---

## 1. Button with Variants

### Description

Reusable button with variants (primary, secondary, danger), sizes (sm, md, lg), and disabled state.

### Agent Prompt

```
Create a Svelte 5 button component with:
- Props: variant (primary/secondary/danger), size (sm/md/lg), disabled
- Forward click events to parent
- Basic styling for each variant
```

### Testing Strategy

```typescript
test("applies variant class", () => {
  render(Button, { props: { variant: "primary" } });
  expect(screen.getByRole("button")).toHaveClass("primary");
});

test("disabled prevents click", async () => {
  const onClick = vi.fn();
  render(Button, { props: { disabled: true, onclick: onClick } });
  await fireEvent.click(screen.getByRole("button"));
  expect(onClick).not.toHaveBeenCalled();
});
```

### Validation

- ✓ Uses `$props()` for props
- ✗ No `export let`
- ✗ No `createEventDispatcher`

---

## 2. Accordion Component

### Description

Collapsible sections with optional single-open mode.

### Agent Prompt

```
Create a Svelte 5 accordion with:
- Props: items ({title, content}[]), single (boolean)
- Click title to toggle section
- ARIA attributes for accessibility
```

### Testing Strategy

```typescript
test("clicking opens section", async () => {
  render(Accordion, {
    props: { items: [{ title: "A", content: "Content A" }] },
  });
  await fireEvent.click(screen.getByText("A"));
  expect(screen.getByText("Content A")).toBeVisible();
});

test("single mode closes others", async () => {
  render(Accordion, { props: { items, single: true } });
  await fireEvent.click(screen.getByText("Section 1"));
  await fireEvent.click(screen.getByText("Section 2"));
  expect(screen.getByText("Content 1")).not.toBeVisible();
});
```

### Validation

- ✓ Uses `$state()` for open indices
- ✓ Has `aria-expanded` attributes
- ✗ No `$effect` for UI state

---

## 3. Tabs Component

### Description

Tabbed interface with keyboard navigation.

### Agent Prompt

```
Create a Svelte 5 tabs component with:
- Props: tabs ({label, content}[])
- Click tab to show content
- Arrow key navigation
- ARIA roles (tablist, tab, tabpanel)
```

### Testing Strategy

```typescript
test("clicking tab shows content", async () => {
  render(Tabs, { props: { tabs } });
  await fireEvent.click(screen.getByRole("tab", { name: "Tab 2" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Content 2");
});

test("arrow keys navigate", async () => {
  render(Tabs, { props: { tabs } });
  const tab = screen.getByRole("tab", { name: "Tab 1" });
  tab.focus();
  await fireEvent.keyDown(tab, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Tab 2" })).toHaveFocus();
});
```

### Validation

- ✓ Uses `$state()` for activeIndex
- ✓ Has `role="tablist"`, `role="tab"`, `role="tabpanel"`
- ✗ No `$:` reactive statements

---

## 4. Toggle/Switch

### Description

Boolean toggle switch with accessibility.

### Agent Prompt

```
Create a Svelte 5 toggle switch with:
- Props: checked (bindable), disabled, label
- Keyboard togglable (Space/Enter)
- role="switch" with aria-checked
```

### Testing Strategy

```typescript
test("clicking toggles state", async () => {
  render(Toggle, { props: { checked: false } });
  await fireEvent.click(screen.getByRole("switch"));
  expect(screen.getByRole("switch")).toBeChecked();
});

test("space key toggles", async () => {
  render(Toggle, { props: { checked: false } });
  await fireEvent.keyDown(screen.getByRole("switch"), { key: " " });
  expect(screen.getByRole("switch")).toBeChecked();
});
```

### Validation

- ✓ Uses `$props()` with `$bindable()` for checked
- ✓ Has `role="switch"` and `aria-checked`
- ✗ No separate `$state` if using bindable prop

---

## 5. Counter with Bounds

### Description

Counter with increment, decrement, reset, and min/max limits.

### Agent Prompt

```
Create a Svelte 5 counter with:
- Props: initialValue, min, max
- Buttons: increment, decrement, reset
- Disable buttons at bounds
```

### Testing Strategy

```typescript
test("increment increases count", async () => {
  render(Counter, { props: { initialValue: 0 } });
  await fireEvent.click(screen.getByRole("button", { name: /increment/i }));
  expect(screen.getByText("1")).toBeInTheDocument();
});

test("increment disabled at max", () => {
  render(Counter, { props: { initialValue: 10, max: 10 } });
  expect(screen.getByRole("button", { name: /increment/i })).toBeDisabled();
});

test("reset returns to initial", async () => {
  render(Counter, { props: { initialValue: 5 } });
  await fireEvent.click(screen.getByRole("button", { name: /increment/i }));
  await fireEvent.click(screen.getByRole("button", { name: /reset/i }));
  expect(screen.getByText("5")).toBeInTheDocument();
});
```

### Validation

- ✓ Uses `$state()` for count
- ✓ Uses `$derived()` for atMin/atMax
- ✗ No `$effect` for bounds checking

---

## 6. Todo List

### Description

Todo list with add, remove, toggle, and count.

### Agent Prompt

```
Create a Svelte 5 todo list with:
- Input to add todos
- Checkbox to toggle complete
- Delete button per todo
- Display remaining count
```

### Testing Strategy

```typescript
test("can add todo", async () => {
  render(TodoList);
  await fireEvent.input(screen.getByRole("textbox"), {
    target: { value: "New task" },
  });
  await fireEvent.submit(screen.getByRole("form"));
  expect(screen.getByText("New task")).toBeInTheDocument();
});

test("toggle marks complete", async () => {
  render(TodoList, {
    props: { initial: [{ id: 1, text: "Task", done: false }] },
  });
  await fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox")).toBeChecked();
});

test("shows remaining count", () => {
  render(TodoList, {
    props: {
      initial: [
        { id: 1, text: "A", done: false },
        { id: 2, text: "B", done: true },
      ],
    },
  });
  expect(screen.getByText(/1 item left/i)).toBeInTheDocument();
});
```

### Validation

- ✓ Uses `$state()` for todos array
- ✓ Uses `$derived()` for remaining count
- ✓ Uses `{#each todos as todo (todo.id)}` with key
- ✗ No `$effect` for count calculation

---

## 7. Password Strength Checker

### Description

Password input with strength meter and criteria checklist.

### Agent Prompt

```
Create a Svelte 5 password strength checker with:
- Password input with show/hide toggle
- Strength meter (weak/fair/strong/very strong)
- Checklist: length≥8, uppercase, lowercase, number, special char
```

### Testing Strategy

```typescript
test("weak password shows weak", async () => {
  render(PasswordStrength);
  await fireEvent.input(screen.getByLabelText(/password/i), {
    target: { value: "abc" },
  });
  expect(screen.getByText(/weak/i)).toBeInTheDocument();
});

test("criteria updates on input", async () => {
  render(PasswordStrength);
  await fireEvent.input(screen.getByLabelText(/password/i), {
    target: { value: "Password1!" },
  });
  expect(screen.getByText(/uppercase/i)).toHaveClass("met");
  expect(screen.getByText(/number/i)).toHaveClass("met");
});

test("show button reveals password", async () => {
  render(PasswordStrength);
  expect(screen.getByLabelText(/password/i)).toHaveAttribute(
    "type",
    "password",
  );
  await fireEvent.click(screen.getByRole("button", { name: /show/i }));
  expect(screen.getByLabelText(/password/i)).toHaveAttribute("type", "text");
});
```

### Validation

- ✓ Uses `$state()` for password and showPassword
- ✓ Uses `$derived()` for all criteria and strength
- ✗ No `$effect` for computing strength

---

## 8. Temperature Converter

### Description

Bidirectional converter between Celsius, Fahrenheit, and Kelvin.

### Agent Prompt

```
Create a Svelte 5 temperature converter with:
- Three inputs: Celsius, Fahrenheit, Kelvin
- Changing any input updates the others
- Handle decimals with reasonable precision
```

### Testing Strategy

```typescript
test("celsius to fahrenheit", async () => {
  render(TempConverter);
  await fireEvent.input(screen.getByLabelText(/celsius/i), {
    target: { value: "0" },
  });
  expect(screen.getByLabelText(/fahrenheit/i)).toHaveValue(32);
});

test("fahrenheit to celsius", async () => {
  render(TempConverter);
  await fireEvent.input(screen.getByLabelText(/fahrenheit/i), {
    target: { value: "212" },
  });
  expect(screen.getByLabelText(/celsius/i)).toHaveValue(100);
});
```

### Validation

- ✓ Single `$state()` as source of truth
- ✓ Uses `$derived()` for other scales
- ✗ No multiple `$state` that update each other (causes loops)
- ✗ No `$effect` for conversions

---

## 9. Timer/Stopwatch

### Description

Timer with start, pause, reset, and lap functionality.

### Agent Prompt

```
Create a Svelte 5 timer with:
- Start/Pause/Reset controls
- Lap recording
- Display in MM:SS.ms format
- Optional countdown mode
```

### Testing Strategy

```typescript
test("start begins counting", async () => {
  vi.useFakeTimers();
  render(Timer);
  await fireEvent.click(screen.getByRole("button", { name: /start/i }));
  vi.advanceTimersByTime(1000);
  expect(screen.getByText("00:01.00")).toBeInTheDocument();
  vi.useRealTimers();
});

test("pause stops counting", async () => {
  vi.useFakeTimers();
  render(Timer);
  await fireEvent.click(screen.getByRole("button", { name: /start/i }));
  vi.advanceTimersByTime(1000);
  await fireEvent.click(screen.getByRole("button", { name: /pause/i }));
  vi.advanceTimersByTime(1000);
  expect(screen.getByText("00:01.00")).toBeInTheDocument();
  vi.useRealTimers();
});
```

### Validation

- ✓ Uses `$state()` for elapsed time and running state
- ✓ Uses `$derived()` for formatted display
- ✓ Uses `$effect()` CORRECTLY for setInterval (valid use case!)
- ✓ `$effect` returns cleanup (clearInterval)

---

## 10. Form with Validation

### Description

Form with real-time validation for multiple fields.

### Agent Prompt

```
Create a Svelte 5 form with:
- Fields: name (required, min 2), email (valid format), age (18-120)
- Real-time validation on blur
- Error messages per field
- Submit disabled until valid
```

### Testing Strategy

```typescript
test("shows error for empty required field", async () => {
  render(Form);
  await fireEvent.blur(screen.getByLabelText(/name/i));
  expect(screen.getByText(/name is required/i)).toBeInTheDocument();
});

test("validates email format", async () => {
  render(Form);
  await fireEvent.input(screen.getByLabelText(/email/i), {
    target: { value: "notvalid" },
  });
  await fireEvent.blur(screen.getByLabelText(/email/i));
  expect(screen.getByText(/valid email/i)).toBeInTheDocument();
});

test("submit disabled when invalid", () => {
  render(Form);
  expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
});
```

### Validation

- ✓ Uses `$state()` for field values and touched states
- ✓ Uses `$derived()` for errors and isValid
- ✗ No `$effect` for validation logic

---

## 11. Search Filter

### Description

Search input that filters a local array in real-time.

### Agent Prompt

```
Create a Svelte 5 search filter with:
- Props: items (object[]), searchFields (string[])
- Case-insensitive matching
- Display filtered count
```

### Testing Strategy

```typescript
test("filters items", async () => {
  render(SearchFilter, {
    props: {
      items: [{ name: "Apple" }, { name: "Banana" }],
      searchFields: ["name"],
    },
  });
  await fireEvent.input(screen.getByRole("searchbox"), {
    target: { value: "app" },
  });
  expect(screen.getByText("Apple")).toBeInTheDocument();
  expect(screen.queryByText("Banana")).not.toBeInTheDocument();
});

test("shows result count", async () => {
  render(SearchFilter, { props: { items, searchFields: ["name"] } });
  await fireEvent.input(screen.getByRole("searchbox"), {
    target: { value: "a" },
  });
  expect(screen.getByText(/2 results/i)).toBeInTheDocument();
});
```

### Validation

- ✓ Uses `$state()` for search term
- ✓ Uses `$derived()` for filtered items and count
- ✗ No `$effect` for filtering

---

## 12. Multi-Select Checklist

### Description

Checklist with select all functionality.

### Agent Prompt

```
Create a Svelte 5 checklist with:
- Props: items ({id, label}[])
- Select All checkbox (indeterminate when partial)
- Display selected count
```

### Testing Strategy

```typescript
test("select all checks all items", async () => {
  render(Checklist, { props: { items } });
  await fireEvent.click(screen.getByLabelText(/select all/i));
  screen.getAllByRole("checkbox").forEach((cb) => expect(cb).toBeChecked());
});

test("indeterminate when partial", async () => {
  render(Checklist, { props: { items } });
  await fireEvent.click(screen.getByLabelText("Item 1"));
  expect(screen.getByLabelText(/select all/i)).toHaveProperty(
    "indeterminate",
    true,
  );
});
```

### Validation

- ✓ Uses `$state()` for selected Set/array
- ✓ Uses `$derived()` for allSelected and someSelected
- ✗ No `$effect` to sync select all state

---

## 13. Tag Input

### Description

Input that creates removable tags from text.

### Agent Prompt

```
Create a Svelte 5 tag input with:
- Enter/comma creates tag
- X button removes tag
- Backspace on empty removes last tag
- Props: maxTags, allowDuplicates
```

### Testing Strategy

```typescript
test("Enter adds tag", async () => {
  render(TagInput);
  const input = screen.getByRole("textbox");
  await fireEvent.input(input, { target: { value: "tag1" } });
  await fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByText("tag1")).toBeInTheDocument();
});

test("X removes tag", async () => {
  render(TagInput, { props: { initial: ["tag1"] } });
  await fireEvent.click(screen.getByRole("button", { name: /remove/i }));
  expect(screen.queryByText("tag1")).not.toBeInTheDocument();
});

test("respects maxTags", async () => {
  render(TagInput, { props: { maxTags: 2, initial: ["a", "b"] } });
  const input = screen.getByRole("textbox");
  await fireEvent.input(input, { target: { value: "c" } });
  await fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.queryByText("c")).not.toBeInTheDocument();
});
```

### Validation

- ✓ Uses `$state()` for tags array
- ✓ Uses `$derived()` for canAddMore
- ✓ Uses `{#each}` with unique key

---

## 14. Multi-Step Form Wizard

### Description

Form wizard with step navigation and validation.

### Agent Prompt

```
Create a Svelte 5 form wizard with:
- Props: steps ({title, fields}[])
- Previous/Next navigation
- Validate current step before advancing
- Submit on final step
```

### Testing Strategy

```typescript
test("next advances step", async () => {
  render(FormWizard, { props: { steps } });
  await fireEvent.input(screen.getByLabelText(/name/i), {
    target: { value: "John" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(screen.getByText("Step 2")).toBeInTheDocument();
});

test("validation prevents advance", async () => {
  render(FormWizard, { props: { steps } });
  await fireEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(screen.getByText(/required/i)).toBeInTheDocument();
});
```

### Validation

- ✓ Uses `$state()` for currentStep and formData
- ✓ Uses `$derived()` for isFirstStep, isLastStep
- ✗ No `$effect` for step management

---

## 16. Card with Slots

### Description

Card component with header, body, footer slots.

### Agent Prompt

```
Create a Svelte 5 card with:
- Named slots: header, default (body), footer
- Props: variant (elevated/outlined), padding
- Only render slot wrappers if content provided
```

### Testing Strategy

```typescript
test("renders body", () => {
  render(Card, { slots: { default: "<p>Content</p>" } });
  expect(screen.getByText("Content")).toBeInTheDocument();
});

test("header not rendered when empty", () => {
  const { container } = render(Card, { slots: { default: "<p>Body</p>" } });
  expect(container.querySelector(".card-header")).not.toBeInTheDocument();
});
```

### Validation

- ✓ Uses `{@render}` for slots
- ✓ Uses `{#if}` to conditionally render wrappers
- ✗ No `<slot>` element (Svelte 4)

---

## Static Analysis Validation Prompt

Use this prompt to validate generated code:

```
Analyze this Svelte 5 component. Check for:

**Must Use (Svelte 5):**
- $state() for reactive state
- $derived() for computed values
- $props() for component props
- $bindable() for two-way binding
- {@render} for snippets/slots

**Must NOT Use (Svelte 4):**
- export let (use $props)
- $: reactive statements (use $derived)
- createEventDispatcher (use callback props)
- <slot> element (use {@render})
- on:event directive (use onevent props)

**$effect() Rules:**
✓ VALID: DOM manipulation, subscriptions, timers, event listeners
✗ INVALID: Computed values, state sync, derived data

Report violations with line numbers.
```

---

## Test Setup

### vitest.config.js

```javascript
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.js"],
    globals: true,
  },
});
```

### setup.js

```javascript
import "@testing-library/jest-dom";
```

---

## Scoring Rubric

| Criteria                   | Points  |
| -------------------------- | ------- |
| Functionality works        | 40      |
| Correct Svelte 5 syntax    | 25      |
| Proper $derived vs $effect | 15      |
| Accessibility              | 10      |
| Code quality               | 10      |
| **Total**                  | **100** |

### Automatic Deductions

- `export let` instead of `$props()`: **-25**
- `$:` instead of `$derived()`: **-25**
- `$effect` for derived values: **-15**
- `<slot>` instead of `{@render}`: **-15**
- `createEventDispatcher`: **-10**
- Missing ARIA when specified: **-5 each**
