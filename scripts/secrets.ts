#!/usr/bin/env bun
/**
 * Simple CLI tool for managing VERCEL_OIDC_TOKEN using bun.secrets
 * 
 * Usage:
 *   bun run secrets set VERCEL_OIDC_TOKEN <value>  # Set the token
 *   bun run secrets get VERCEL_OIDC_TOKEN         # Get the token
 *   bun run secrets                            # Show status
 */

import { secrets } from "bun";

async function showStatus() {
  console.log("\n🔐 Vercel OIDC Token Status");
  console.log("─".repeat(40));
  
  const token = await secrets.get({ 
    service: "svelte-ai", 
    name: "VERCEL_OIDC_TOKEN" 
  });
  
  if (token) {
    const masked = token.slice(0, 12) + "..." + token.slice(-8);
    console.log(`✅ VERCEL_OIDC_TOKEN: ${masked}`);
  } else {
    console.log("❌ VERCEL_OIDC_TOKEN: Not set");
    console.log("\n💡 Run 'bun run secrets set VERCEL_OIDC_TOKEN <value>' to set it");
  }
}

async function setToken(value: string) {
  if (!value) {
    // Empty value means delete the token
    await secrets.delete({ 
      service: "svelte-ai", 
      name: "VERCEL_OIDC_TOKEN" 
    });
    console.log("🗑️  VERCEL_OIDC_TOKEN deleted from OS credential manager");
    return;
  }
  
  if (value.length < 20) {
    console.error("❌ Invalid token: VERCEL_OIDC_TOKEN appears to be too short");
    process.exit(1);
  }
  
  await secrets.set({
    service: "svelte-ai",
    name: "VERCEL_OIDC_TOKEN",
    value,
  });
  
  console.log("✅ VERCEL_OIDC_TOKEN stored securely in OS credential manager");
}

async function getToken() {
  const token = await secrets.get({ 
    service: "svelte-ai", 
    name: "VERCEL_OIDC_TOKEN" 
  });
  
  if (token) {
    console.log(`VERCEL_OIDC_TOKEN: ${token}`);
  } else {
    console.log("❌ VERCEL_OIDC_TOKEN not found");
    process.exit(1);
  }
}

async function loadTokenToEnv() {
  const token = await secrets.get({ 
    service: "svelte-ai", 
    name: "VERCEL_OIDC_TOKEN" 
  });
  
  if (token) {
    process.env.VERCEL_OIDC_TOKEN = token;
    console.log("✅ VERCEL_OIDC_TOKEN loaded from bun.secrets");
  }
}

// Export for use in main application
export { loadTokenToEnv };

// CLI logic
if (import.meta.main) {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];
  
  switch (command) {
    case "set":
      if (arg1 !== "VERCEL_OIDC_TOKEN") {
        console.error("Usage: bun run secrets set VERCEL_OIDC_TOKEN <value>");
        process.exit(1);
      }
      // Empty arg2 means delete, otherwise set the value
      await setToken(arg2 || "");
      break;
      
    case "get":
      if (arg1 !== "VERCEL_OIDC_TOKEN") {
        console.error("Usage: bun run secrets get VERCEL_OIDC_TOKEN");
        process.exit(1);
      }
      await getToken();
      break;
      
    case "load":
      // Internal command used by main app
      await loadTokenToEnv();
      break;
      
    case undefined:
    case "status":
      await showStatus();
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Available commands: status, set VERCEL_OIDC_TOKEN <value>, get VERCEL_OIDC_TOKEN");
      process.exit(1);
  }
}