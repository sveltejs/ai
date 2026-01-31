# Card Component with Slots

Create a Svelte 5 card component that uses snippets for flexible content areas.

## Requirements

### Props (use `$props()`)
- `variant`: string - either "elevated" or "outlined" (default: "elevated")
- `children`: snippet - the main body content (required)
- `header`: snippet - optional header content
- `footer`: snippet - optional footer content

### Structure
- Card container: `<div class="card {variant}">` with data-testid="card"
- Header section: `<div class="card-header">` with data-testid="card-header" - only rendered if header snippet is provided
- Body section: `<div class="card-body">` with data-testid="card-body" - always rendered, contains children
- Footer section: `<div class="card-footer">` with data-testid="card-footer" - only rendered if footer snippet is provided