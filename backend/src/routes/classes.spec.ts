process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import { authCookieFor } from "../test-utils/authCookie";

jest.mock("../models/Student");
jest.mock("../models/ClassSession");

const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedSession = ClassSession as jest.Mocked<typeof ClassSession>;
const cookie = authCookieFor("admin-1");

beforeEach(() => jest.clearAllMocks());

describe("auth guard", () => {
  it("401s every /api/classes route without a cookie", async () => {
    expect((await request(app).get("/api/classes")).status).toBe(401);
    expect((await request(app).post("/api/classes/mark").send({})).status).toBe(401);
  });
});

describe("GET /api/classes", () => {
  it("builds a month/year date range filter and returns sessions", async () => {
    const sortMock = jest.fn().mockResolvedValue([{ _id: "s1", date: "2026-09-10", status: "completed" }]);
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });
    mockedSession.find.mockReturnValue({ populate: populateMock } as any);

    const res = await request(app)
      .get("/api/classes")
      .query({ student: "507f1f77bcf86cd799439011", month: 9, year: 2026 })
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(mockedSession.find).toHaveBeenCalledWith(
      expect.objectContaining({
        student: "507f1f77bcf86cd799439011",
        date: { $gte: "2026-09-01", $lte: "2026-09-30" },
      })
    );
  });

  it("400s on an invalid student id", async () => {
    const res = await request(app).get("/api/classes").query({ student: "not-an-id" }).set("Cookie", cookie);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/classes/mark", () => {
  const studentId = "507f1f77bcf86cd799439011";

  it("404s if the student doesn't exist", async () => {
    mockedStudent.findById.mockResolvedValue(null as any);

    const res = await request(app)
      .post("/api/classes/mark")
      .set("Cookie", cookie)
      .send({ student: studentId, date: "2026-09-10", status: "completed" });

    expect(res.status).toBe(404);
  });

  it("creates (201) a new record when the date has no existing one", async () => {
    mockedStudent.findById.mockResolvedValue({ _id: studentId } as any);
    mockedSession.findOne.mockResolvedValue(null as any); // nothing there yet
    mockedSession.findOneAndUpdate.mockResolvedValue({
      _id: "cs1",
      student: studentId,
      date: "2026-09-10",
      status: "completed",
    } as any);

    const res = await request(app)
      .post("/api/classes/mark")
      .set("Cookie", cookie)
      .send({ student: studentId, date: "2026-09-10", status: "completed" });

    expect(res.status).toBe(201);
    expect(mockedSession.findOneAndUpdate).toHaveBeenCalledWith(
      { student: studentId, date: "2026-09-10" },
      expect.objectContaining({ status: "completed" }),
      expect.objectContaining({ upsert: true })
    );
  });

  it("updates (200, not 201) when a record already exists for that date -- this is THE rule: one record per student/date, status transitions instead of new rows", async () => {
    mockedStudent.findById.mockResolvedValue({ _id: studentId } as any);
    mockedSession.findOne.mockResolvedValue({ _id: "cs1", status: "scheduled" } as any); // already there
    mockedSession.findOneAndUpdate.mockResolvedValue({
      _id: "cs1",
      student: studentId,
      date: "2026-09-10",
      status: "completed",
    } as any);

    const res = await request(app)
      .post("/api/classes/mark")
      .set("Cookie", cookie)
      .send({ student: studentId, date: "2026-09-10", status: "completed" });

    expect(res.status).toBe(200);
    // Only one upsert call ever happens -- never a second ClassSession.create
    expect(mockedSession.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("scheduling a date never reports as completed", async () => {
    mockedStudent.findById.mockResolvedValue({ _id: studentId } as any);
    mockedSession.findOne.mockResolvedValue(null as any);
    mockedSession.findOneAndUpdate.mockResolvedValue({
      _id: "cs1",
      student: studentId,
      date: "2026-09-11",
      status: "scheduled",
    } as any);

    const res = await request(app)
      .post("/api/classes/mark")
      .set("Cookie", cookie)
      .send({ student: studentId, date: "2026-09-11", status: "scheduled" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("scheduled");
  });

  it("400s on a malformed date", async () => {
    const res = await request(app)
      .post("/api/classes/mark")
      .set("Cookie", cookie)
      .send({ student: studentId, date: "not-a-date", status: "completed" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/classes (direct create, back-compat path)", () => {
  const studentId = "507f1f77bcf86cd799439011";

  it("surfaces the DB's duplicate-key error as a friendly 409, not a 500", async () => {
    mockedStudent.findById.mockResolvedValue({ _id: studentId } as any);
    const dupError: any = new Error("duplicate key");
    dupError.code = 11000;
    mockedSession.create.mockRejectedValue(dupError);

    const res = await request(app)
      .post("/api/classes")
      .set("Cookie", cookie)
      .send({ student: studentId, date: "2026-09-10", status: "completed" });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/classes/:id", () => {
  it("404s when the record doesn't exist", async () => {
    mockedSession.findByIdAndDelete.mockResolvedValue(null as any);
    const res = await request(app).delete("/api/classes/507f1f77bcf86cd799439099").set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("removes an existing record", async () => {
    mockedSession.findByIdAndDelete.mockResolvedValue({ _id: "cs1" } as any);
    const res = await request(app).delete("/api/classes/507f1f77bcf86cd799439099").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("400s on a malformed id (never reaches the DB call)", async () => {
    const res = await request(app).delete("/api/classes/not-an-id").set("Cookie", cookie);
    expect(res.status).toBe(400);
    expect(mockedSession.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
