import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const base = process.env.GITHUB_PAGES === "true" ? "/hydro-flow/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@diagram": path.resolve(__dirname, "src/diagram"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  worker: { format: "es" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 20000,
  },
});
