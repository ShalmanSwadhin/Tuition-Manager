import axios from "axios";

const api = axios.create({
  // Defaults to same-origin /api: proxied by Vite in dev and by the rewrite in
  // vercel.json in production. Set VITE_API_URL only to call the API directly.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // send the httpOnly JWT cookie
});

export default api;
