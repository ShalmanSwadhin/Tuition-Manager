// End-to-end behaviour of a login session through the real app: cookie
// attributes, expiry, signature/algorithm checks, restarts and logout.
// Only the User model is mocked.
process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
process.env.NODE_ENV = "test";

import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import app from "../app";
import User from "../models/User";

jest.mock("../models/User");
const mockedUser = User as jest.Mocked<typeof User>;

const NINETY_DAYS = 90 * 24 * 60 * 60;
const now = () => Math.floor(Date.now() / 1000);
let passwordHash: string;

const teacher = () => ({ id: "t1", _id: "t1", name: "Ms Rahman", email: "rahman@example.com", role: "teacher", teacherKey: "K7M3QX", passwordHash });

beforeAll(async () => {
  passwordHash = await bcrypt.hash("correct-password", 4);
});
beforeEach(() => {
  jest.clearAllMocks();
  mockedUser.findOne.mockResolvedValue(teacher() as any);
  mockedUser.findById.mockResolvedValue(teacher() as any);
});

async function login(email = "rahman@example.com") {
  const res = await request(app).post("/api/auth/login").send({ email, password: "correct-password" });
  const setCookie: string = res.headers["set-cookie"]?.[0] ?? "";
  return { res, setCookie, token: /token=([^;]*)/.exec(setCookie)?.[1] ?? "" };
}

const me = (token: string) => request(app).get("/api/auth/me").set("Cookie", `token=${token}`);

describe("login", () => {
  it("sets one secure-by-default session cookie lasting 90 days", async () => {
    const { res, setCookie, token } = await login();
    expect(res.status).toBe(200);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(new RegExp(`Max-Age=${NINETY_DAYS}`));
    expect(setCookie).not.toMatch(/Domain=/); // host-only: belongs to the app's own address

    const { header, payload } = jwt.decode(token, { complete: true }) as any;
    expect(header.alg).toBe("HS256");
    expect(payload.exp - payload.iat).toBe(NINETY_DAYS); // token and cookie expire together
    expect(payload).toMatchObject({ sub: "t1", role: "teacher" });
  });

  it("marks the cookie Secure in production", async () => {
    process.env.NODE_ENV = "production";
    try {
      const { setCookie } = await login();
      expect(setCookie).toMatch(/Secure/);
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  it("never returns the password hash", async () => {
    const { res } = await login();
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });

  it("wrong password: 401 with the same message as an unknown email, and no cookie", async () => {
    const wrong = await request(app).post("/api/auth/login").send({ email: "rahman@example.com", password: "nope" });
    mockedUser.findOne.mockResolvedValue(null as any);
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "nope" });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });
});

describe("staying signed in", () => {
  it("the cookie keeps working on later requests (e.g. after a page refresh)", async () => {
    const { token } = await login();
    const res = await me(token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "t1", role: "teacher" });
  });

  it("still valid after the backend restarts (no server-side session state to lose)", async () => {
    const { token } = await login();
    let restartedApp: typeof app;
    jest.isolateModules(() => {
      restartedApp = require("../app").default; // a fresh copy of the whole app
    });
    expect(restartedApp!).not.toBe(app);
    const res = await request(restartedApp!).get("/api/auth/me").set("Cookie", `token=${token}`);
    expect(res.status).toBe(200);
  });

  it("is still valid on day 89", async () => {
    const token = jwt.sign({ sub: "t1", role: "teacher", iat: now() - 89 * 86400, exp: now() + 86400 }, process.env.JWT_SECRET!);
    expect((await me(token)).status).toBe(200);
  });
});

describe("expiry and tampering", () => {
  it("after 90 days the session is over and the user must sign in again", async () => {
    const token = jwt.sign({ sub: "t1", role: "teacher", iat: now() - 91 * 86400, exp: now() - 86400 }, process.env.JWT_SECRET!);
    const res = await me(token);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired session" });
  });

  it("rejects a token signed with another secret", async () => {
    const token = jwt.sign({ sub: "t1", role: "teacher" }, "some-other-secret");
    expect((await me(token)).status).toBe(401);
  });

  it("rejects a token using a different algorithm, even with the right secret", async () => {
    const token = jwt.sign({ sub: "t1", role: "teacher" }, process.env.JWT_SECRET!, { algorithm: "HS512" });
    expect((await me(token)).status).toBe(401);
  });

  it('rejects an unsigned ("alg: none") token', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "admin-1", role: "admin" })}.`;
    expect((await me(token)).status).toBe(401);
  });

  it("rejects a token whose role was edited", async () => {
    const { token } = await login();
    const [h, , sig] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "t1", role: "admin", iat: now(), exp: now() + 999 })).toString("base64url")}.${sig}`;
    expect((await me(forged)).status).toBe(401);
  });

  it("a deleted account can't keep using an old session", async () => {
    const { token } = await login();
    mockedUser.findById.mockResolvedValue(null as any);
    expect((await me(token)).status).toBe(401);
  });
});

describe("logout", () => {
  it("clears the cookie with matching attributes so the browser really deletes it", async () => {
    const res = await request(app).post("/api/auth/logout");
    const cleared: string = res.headers["set-cookie"][0];
    expect(res.status).toBe(200);
    expect(cleared).toMatch(/^token=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cleared).toMatch(/Path=\//);
    expect(cleared).toMatch(/SameSite=Lax/);
    expect(cleared).toMatch(/HttpOnly/);
  });
});

describe("database trouble during login", () => {
  it("returns a clean 500 instead of hanging or pretending the password was wrong", async () => {
    mockedUser.findOne.mockRejectedValue(new Error("MongoServerSelectionError: connection timed out"));
    const res = await request(app).post("/api/auth/login").send({ email: "rahman@example.com", password: "x" });
    expect(res.status).toBe(500);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("in production, hides internal error details from the browser", async () => {
    mockedUser.findOne.mockRejectedValue(new Error("MongoServerSelectionError: cluster0.example.mongodb.net timed out"));
    process.env.NODE_ENV = "production";
    try {
      const res = await request(app).post("/api/auth/login").send({ email: "rahman@example.com", password: "x" });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error" });
    } finally {
      process.env.NODE_ENV = "test";
    }
  });
});

describe("CORS for the deployed frontend", () => {
  it("only the configured frontend origin is allowed, with credentials", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
