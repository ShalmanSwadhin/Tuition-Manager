process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app";
import Admin from "../models/Admin";
import { authCookieFor } from "../test-utils/authCookie";

jest.mock("../models/Admin");

const mockedAdmin = Admin as jest.Mocked<typeof Admin>;

describe("POST /api/auth/login", () => {
  const plainPassword = "correct-horse-battery-staple";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(plainPassword, 4); // low cost factor, just for test speed
  });

  afterEach(() => jest.clearAllMocks());

  it("rejects an unknown email with 401 (never reveals which part was wrong)", async () => {
    mockedAdmin.findOne.mockResolvedValue(null as any);

    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("rejects a wrong password with 401", async () => {
    mockedAdmin.findOne.mockResolvedValue({ id: "admin-1", passwordHash, email: "me@example.com" } as any);

    const res = await request(app).post("/api/auth/login").send({ email: "me@example.com", password: "wrong" });

    expect(res.status).toBe(401);
  });

  it("logs in with correct credentials and sets an httpOnly cookie", async () => {
    mockedAdmin.findOne.mockResolvedValue({
      id: "admin-1",
      name: "Turgut",
      email: "me@example.com",
      passwordHash,
    } as any);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "me@example.com", password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "admin-1", name: "Turgut", email: "me@example.com" });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=.*HttpOnly/i);
  });

  it("rejects a malformed request body (zod validation)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  afterEach(() => jest.clearAllMocks());

  it("401s with no auth cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the admin profile with a valid cookie", async () => {
    (Admin.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ id: "admin-1", name: "Turgut", email: "me@example.com" }),
    });

    const res = await request(app).get("/api/auth/me").set("Cookie", authCookieFor("admin-1"));

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("me@example.com");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie and returns ok", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
