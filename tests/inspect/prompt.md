Create a Svelte 5 component that uses the `$inspect` rune to log and track state changes.

The component should have a text input starting with "Hello world", use basic `$inspect` to log the value, implement `$inspect(...).with` to track updates with a custom callback, and use `$inspect.trace()` inside an effect. Display the input value and character count.
