import express from "express";
// Must be imported before any routers are used. Express 4 does not forward
// a rejected promise from an async handler to the error handler on its
// own — without this, a DB hiccup inside any route makes that request hang
// forever instead of returning a 500. This patches Express so it does.
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import studentRoutes from "./routes/students";
import classRoutes from "./routes/classes";
import diaryRoutes from "./routes/diary";
import examRoutes from "./routes/exams";
import reminderRoutes from "./routes/reminders";
import dashboardRoutes from "./routes/dashboard";
import reportRoutes from "./routes/reports";
import adminRoutes from "./routes/admin";

const app = express();

// Render (and Vercel's /api rewrite in front of it) sit behind proxies. Without
// this, req.ip is the proxy's IP and express-rate-limit rejects the
// X-Forwarded-For header. A hop count, not `true`, so clients can't spoof it.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

// CORS_ORIGIN may be a comma-separated list (e.g. production + preview URLs)
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/diary", diaryRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

// 404 for unmatched API routes
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler — keeps stack traces out of responses
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  res.status(err?.status || 500).json({ error: err?.message || "Internal server error" });
});

export default app;
