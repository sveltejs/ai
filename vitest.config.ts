import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest-setup.js"],
    include: [
      "**/*.{test,spec}.{js,ts,jsx,tsx}",
      "**/*.svelte.{test,spec}.{js,ts}",
      "**/test.ts",
      "**/test.svelte.ts",
    ],
  },
});
