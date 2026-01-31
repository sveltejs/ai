---
name: scenario-writer
description: Picks a new scenario to create based on the description of the user, delegates the writing of it to the ai-scenario-writer subagent and verify the correctness.
---

Implement the scenario proposed by the user if that has not been implemented yet. Then invoke the `ai-scenario-writer` subagent to actually write the test in a separate context. When it finishes please validate its work and launch a new subagent with a new task if the user proposed multiple scenarios (or to correct the work of the last one).

## Test Structure

Each test in the `tests/` directory should have:

```
tests/
  {test-name}/
    Reference.svelte  - Reference implementation (known-good solution)
    test.ts          - Vitest test file (imports "./Component.svelte")
    prompt.md        - Prompt for the AI agent
    validator.ts     - Extra validation to verify with static analysis that the code written adhere to Svelte best practices
```

The benchmark:

1. Reads the prompt from `prompt.md`
2. Asks the agent to generate a component
3. Writes the generated component to a temporary location
4. Runs the tests against the generated component
5. Reports pass/fail status

## Verifying Reference Implementations

To verify that all reference implementations pass their tests:

```bash
bun run verify-tests
```

This copies each `Reference.svelte` to `Component.svelte` temporarily and runs the tests.
