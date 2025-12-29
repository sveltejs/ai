import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TestDefinition } from "./test-discovery.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidatorModule {
  validate: (code: string) => ValidationResult;
}

/**
 * Check if a test has a validator.ts file
 */
export function hasValidator(test: TestDefinition): boolean {
  const validatorPath = join(test.directory, "validator.ts");
  return existsSync(validatorPath);
}

/**
 * Get the validator path for a test
 */
export function getValidatorPath(test: TestDefinition): string | null {
  const validatorPath = join(test.directory, "validator.ts");
  return existsSync(validatorPath) ? validatorPath : null;
}

/**
 * Run the validator for a test against the generated code.
 * Returns null if no validator exists.
 */
export async function runValidator(
  test: TestDefinition,
  code: string,
): Promise<ValidationResult | null> {
  const validatorPath = getValidatorPath(test);

  if (!validatorPath) {
    return null;
  }

  try {
    const validatorModule = (await import(validatorPath)) as ValidatorModule;

    if (typeof validatorModule.validate !== "function") {
      return {
        valid: false,
        errors: [
          `Validator at ${validatorPath} does not export a 'validate' function`,
        ],
      };
    }

    const result = validatorModule.validate(code);

    if (typeof result.valid !== "boolean") {
      return {
        valid: false,
        errors: ["Validator returned invalid result: missing 'valid' boolean"],
      };
    }

    return {
      valid: result.valid,
      errors: Array.isArray(result.errors) ? result.errors : [],
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Failed to run validator: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
