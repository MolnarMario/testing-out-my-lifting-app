import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      // docs/ also holds hand-written files (docs/agents/), so emptyOutDir is
      // off. Clear the hashed bundles instead, or every build would leave the
      // previous build's assets behind.
      name: "clear-old-assets",
      apply: "build",
      buildStart() {
        rmSync(fileURLToPath(new URL("./docs/assets", import.meta.url)), {
          recursive: true,
          force: true,
        });
      },
    },
  ],
  // Relative asset paths, so the build works from a project subpath on GitHub
  // Pages without hardcoding the repository name.
  base: "./",
  build: {
    // Pages serves this repo from /docs. Root index.html is the Vite entry, so
    // the build cannot land there without overwriting its own source.
    outDir: "docs",
    emptyOutDir: false,
  },
});
