import { generateReport } from "./lib/report.ts";
import { readdirSync } from "node:fs";

function getAllResultFiles(): string[] {
  const resultsDir = "results";
  const files = readdirSync(resultsDir);

  const resultFiles = files.filter(
    (file) => file.startsWith("result-") && file.endsWith(".json"),
  );

  if (resultFiles.length === 0) {
    throw new Error("No result files found in results/ directory");
  }

  resultFiles.sort((a, b) => b.localeCompare(a));

  return resultFiles.map((file) => `${resultsDir}/${file}`);
}

const resultFiles = getAllResultFiles();

console.log(`Found ${resultFiles.length} result file(s) to process\n`);

for (const jsonPath of resultFiles) {
  const htmlPath = jsonPath.replace(/\.json$/, ".html");
  console.log(`Generating report: ${jsonPath} -> ${htmlPath}`);
  await generateReport(jsonPath, htmlPath, false);
}

console.log(`\nSuccessfully generated ${resultFiles.length} HTML report(s)`);
