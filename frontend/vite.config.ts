import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

// The address the app pings to wake the sleeping Render backend (see
// src/api/client.ts). Taken from the /api rewrite in vercel.json, so the
// backend URL stays configured in one place; VITE_API_WAKE_URL overrides it.
function apiWakeUrl(): string {
  if (process.env.VITE_API_WAKE_URL) return process.env.VITE_API_WAKE_URL;
  try {
    const { rewrites = [] } = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8"));
    const api = rewrites.find((r: { source: string }) => r.source === "/api/:path*");
    return api ? `${new URL(api.destination.replace(":path*", "")).origin}/api/health` : "";
  } catch {
    return "";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __API_WAKE_URL__: JSON.stringify(apiWakeUrl()),
  },
  server: {
    port: 5173,
    // Mirrors the /api rewrite in vercel.json, so the auth cookie is
    // same-origin in dev exactly like in production.
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
