import { generateReport } from "./lib/report.ts";
import { readdirSync } from "node:fs";

/**
 * Get all result files from the results directory
 */
function getAllResultFiles(): string[] {
  const resultsDir = "results";
  const files = readdirSync(resultsDir);

  // Filter for result JSON files
  const resultFiles = files.filter(
    (file) => file.startsWith("result-") && file.endsWith(".json"),
  );

  if (resultFiles.length === 0) {
    throw new Error("No result files found in results/ directory");
  }

  // Sort by filename (which includes timestamp) in descending order
  resultFiles.sort((a, b) => b.localeCompare(a));

  return resultFiles.map((file) => `${resultsDir}/${file}`);
}

// Get all result JSON files
const resultFiles = getAllResultFiles();

console.log(`Found ${resultFiles.length} result file(s) to process\n`);

// Generate HTML report for each JSON file
for (const jsonPath of resultFiles) {
  const htmlPath = jsonPath.replace(/\.json$/, ".html");
  console.log(`Generating report: ${jsonPath} -> ${htmlPath}`);
  await generateReport(jsonPath, htmlPath, false);
}

console.log(`\nSuccessfully generated ${resultFiles.length} HTML report(s)`);
