# Search Filter Component

Create a Svelte 5 search filter component with:

- Props: `items` (object[]), `searchFields` (string[]), `children` a Snippet that accepts an item to render the filtered items
- Case-insensitive matching across specified fields
- Display filtered count showing "X results"

## Requirements

- Use `$props()` for component props
- Use `$state()` for the search query
- Use `$derived()` for filtered items and result count
- Use `@render` to render for each filtered item based with `children` prop 
- Search input should have `role="searchbox"`
- Show result count in format "X results" (e.g., "2 results", "0 results")
