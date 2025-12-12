/**
 * Sanitize model name for filesystem use
 */
export function sanitizeModelName(modelName: string): string {
  return modelName.replace(/[^a-zA-Z0-9.]/g, "-");
}

/**
 * Generate a timestamped filename with optional model name
 * Uses UTC time for consistent timestamps across timezones
 */
export function getTimestampedFilename(
  prefix: string,
  extension: string,
  modelName?: string,
  now: Date = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");

  const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  const modelSuffix = modelName ? `-${sanitizeModelName(modelName)}` : "";

  return `${prefix}-${timestamp}${modelSuffix}.${extension}`;
}
