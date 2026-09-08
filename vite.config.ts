import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "node:crypto": new URL("./src/adapter/browser-crypto.ts", import.meta.url)
        .pathname,
    },
  },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
