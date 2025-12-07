import { verifyAllReferences } from "./lib/verify-references.ts";

console.log("=== Reference Implementation Verification ===\n");

const exitCode = await verifyAllReferences();

process.exit(exitCode);
