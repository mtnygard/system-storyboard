import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Editors/formatters may briefly truncate a file before finishing the write.
  // Do not let HMR cache an empty stylesheet from that intermediate state.
  server: {
    watch: { awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 } },
  },
  resolve: {
    alias: {
      "node:crypto": new URL("./src/adapter/browser-crypto.ts", import.meta.url)
        .pathname,
    },
  },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
