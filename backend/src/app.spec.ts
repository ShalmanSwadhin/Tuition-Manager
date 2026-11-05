process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";

import request from "supertest";
import app from "./app";
import User from "./models/User";
import Student from "./models/Student";
import { authCookieFor } from "./test-utils/authCookie";
import { mockQuery } from "./test-utils/mockQuery";

jest.mock("./models/User");
jest.mock("./models/Student");

describe("GET /api/health", () => {
  it("responds without auth", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("security headers (helmet, real middleware, not mocked)", () => {
  it("sets standard hardening headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
  });
});

describe("CORS (real middleware)", () => {
  it("reflects the configured origin and allows credentials", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("always declares only the configured origin, never echoing back an arbitrary request origin -- " +
    "this is correct for a static (non-function) cors() config: the browser itself refuses to expose the " +
    "response to a page whose own origin doesn't match this header",
    async () => {
      const res = await request(app).get("/api/health").set("Origin", "http://evil.example.com");
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    }
  );
});

describe("404 for unmatched API routes", () => {
  it("returns a clean 404 JSON body, not Express's default HTML page", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("login rate limiting (real express-rate-limit middleware, not mocked)", () => {
  it("blocks after 10 login attempts for the same email within the window", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);

    const results: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/api/auth/login").send({ email: "x@example.com", password: "wrong" });
      results.push(res.status);
    }

    // First 10 are handled normally (401, since User.findOne resolves null);
    // the 11th is the rate limiter itself responding, before the handler runs.
    expect(results.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(results[10]).toBe(429);
  }, 15000);

  it("counts per email, so one user's failed attempts don't lock out others behind the same proxy IP", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post("/api/auth/login").send({ email: "someone-else@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });
});

describe("async route errors reach the client instead of hanging", () => {
  // Express 4 does not forward a rejected promise from an async handler to
  // the error handler by itself. Without express-async-errors imported at
  // the top of app.ts, this exact test hangs past any reasonable timeout
  // instead of ever resolving -- a DB hiccup in production would leave the
  // request open forever. This asserts the fix is actually wired in.
  it("a rejected promise inside a route handler results in a 500, not a hang", async () => {
    (Student.find as jest.Mock).mockReturnValue(mockQuery(null, new Error("simulated DB failure")));

    const res = await request(app).get("/api/students").set("Cookie", authCookieFor("admin-1"));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("simulated DB failure");
  }, 5000);
});
