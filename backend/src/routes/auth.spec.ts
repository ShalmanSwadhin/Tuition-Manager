process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app";
import User from "../models/User";
import Student from "../models/Student";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";

jest.mock("../models/User");
jest.mock("../models/Student");

const mockedUser = User as jest.Mocked<typeof User>;
const mockedStudent = Student as jest.Mocked<typeof Student>;

afterEach(() => jest.clearAllMocks());

describe("POST /api/auth/login", () => {
  const plainPassword = "correct-horse-battery-staple";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(plainPassword, 4); // low cost factor, just for test speed
  });

  it("rejects an unknown email with 401 (never reveals which part was wrong)", async () => {
    mockedUser.findOne.mockResolvedValue(null as any);

    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("rejects a wrong password with 401", async () => {
    mockedUser.findOne.mockResolvedValue({ id: "u1", role: "admin", passwordHash, email: "me@example.com" } as any);

    const res = await request(app).post("/api/auth/login").send({ email: "me@example.com", password: "wrong" });

    expect(res.status).toBe(401);
  });

  it("logs a teacher in, returns their role and key, and sets an httpOnly cookie", async () => {
    mockedUser.findOne.mockResolvedValue({
      id: "t1",
      name: "Turgut",
      email: "me@example.com",
      role: "teacher",
      teacherKey: "K7M3QX",
      passwordHash,
    } as any);

    const res = await request(app).post("/api/auth/login").send({ email: "me@example.com", password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "t1", name: "Turgut", email: "me@example.com", role: "teacher", teacherKey: "K7M3QX" });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/token=.*HttpOnly/i);
  });

  it("keeps the login for 90 days: cookie and token expire together", async () => {
    mockedUser.findOne.mockResolvedValue({ id: "t1", name: "T", email: "me@example.com", role: "teacher", passwordHash } as any);

    const res = await request(app).post("/api/auth/login").send({ email: "me@example.com", password: plainPassword });

    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/Max-Age=7776000/); // 90 * 24 * 60 * 60 seconds
    const token = /token=([^;]+)/.exec(cookie)![1];
    const { iat, exp } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(exp - iat).toBe(7776000);
  });

  it("rejects a malformed request body (zod validation)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/register", () => {
  it("creates a teacher with a 6-character key", async () => {
    mockedUser.exists.mockResolvedValue(null as any);
    mockedUser.create.mockImplementation(async (doc: any) => ({ ...doc, id: "t1" }) as any);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "teacher", name: "Ms Rahman", email: "Rahman@Example.com", password: "secret1" });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("teacher");
    expect(res.body.teacherKey).toMatch(/^[A-Z2-9]{6}$/);
    expect(mockedUser.create).toHaveBeenCalledWith(expect.objectContaining({ email: "rahman@example.com", role: "teacher" }));
    expect(mockedStudent.create).not.toHaveBeenCalled();
  });

  it("409s when the email is taken", async () => {
    mockedUser.exists.mockResolvedValue({ _id: "x" } as any);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "teacher", name: "A", email: "a@example.com", password: "secret1" });
    expect(res.status).toBe(409);
  });

  it("rejects a student whose teacher key matches no teacher", async () => {
    mockedUser.exists.mockResolvedValue(null as any);
    mockedUser.findOne.mockResolvedValue(null as any);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "student", name: "Rafi", email: "rafi@example.com", password: "secret1", teacherKey: "nope99", classGrade: "8" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no teacher/i);
    expect(mockedUser.findOne).toHaveBeenCalledWith({ role: "teacher", teacherKey: "NOPE99" });
    expect(mockedUser.create).not.toHaveBeenCalled();
  });

  it("links a student to the teacher whose key they entered", async () => {
    mockedUser.exists.mockResolvedValue(null as any);
    mockedUser.findOne.mockResolvedValue({ _id: "teacher-oid", role: "teacher" } as any);
    mockedUser.create.mockImplementation(async (doc: any) => ({ ...doc, id: "s-user", _id: "s-user-oid" }) as any);
    mockedStudent.create.mockResolvedValue({} as any);
    mockedStudent.findOne.mockReturnValue(mockQuery({ id: "profile-1", teacher: { name: "Ms Rahman" } }));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "student", name: "Rafi", email: "rafi@example.com", password: "secret1", teacherKey: "k7m3qx", classGrade: "8" });

    expect(res.status).toBe(201);
    expect(mockedStudent.create).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Rafi", classGrade: "8", teacher: "teacher-oid", user: "s-user-oid" })
    );
    expect(res.body).toMatchObject({ role: "student", studentId: "profile-1", teacherName: "Ms Rahman" });
  });

  it("requires a teacher key and class for students", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "student", name: "Rafi", email: "rafi@example.com", password: "secret1" });
    expect(res.status).toBe(400);
  });

  it("can't be used to create an admin", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "admin", name: "Sneaky", email: "s@example.com", password: "secret1" });
    expect(res.status).toBe(400);
  });

  it("enforces a minimum password length", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ role: "teacher", name: "A", email: "a@example.com", password: "123" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("401s with no auth cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the signed-in user", async () => {
    mockedUser.findById.mockResolvedValue({ id: "admin-1", name: "Turgut", email: "me@example.com", role: "admin" } as any);

    const res = await request(app).get("/api/auth/me").set("Cookie", authCookieFor("admin-1"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "admin-1", name: "Turgut", email: "me@example.com", role: "admin" });
  });
});

describe("POST /api/auth/teacher-key", () => {
  it("issues a teacher a new key", async () => {
    mockedUser.exists.mockResolvedValue(null as any);
    (mockedUser.findByIdAndUpdate as jest.Mock).mockImplementation(async (_id: any, update: any) => update);

    const res = await request(app).post("/api/auth/teacher-key").set("Cookie", authCookieFor("t1", "teacher"));

    expect(res.status).toBe(200);
    expect(res.body.teacherKey).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("is teachers only", async () => {
    const res = await request(app).post("/api/auth/teacher-key").set("Cookie", authCookieFor("s1", "student"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie and returns ok", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
