import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works from a project subpath on GitHub
  // Pages without hardcoding the repository name.
  base: "./",
  build: {
    // Pages serves this repo from /docs. Root index.html is the Vite entry, so
    // the build cannot land there without overwriting its own source.
    outDir: "docs",
    emptyOutDir: true,
  },
});
