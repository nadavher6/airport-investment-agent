import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.API_URL ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in dev: the browser calls /api/*, Vite forwards it to the server. No CORS needed.
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});
