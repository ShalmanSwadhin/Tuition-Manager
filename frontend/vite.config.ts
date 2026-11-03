import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Mirrors the /api rewrite in vercel.json, so the auth cookie is
    // same-origin in dev exactly like in production.
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
