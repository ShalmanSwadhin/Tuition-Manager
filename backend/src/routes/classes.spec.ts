process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import ClassSession from "../models/ClassSession";
import Student from "../models/Student";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";
import { todayDhakaStr } from "../utils/dateUtils";

jest.mock("../models/ClassSession");
jest.mock("../models/Student");

const mockedSession = ClassSession as jest.Mocked<typeof ClassSession>;
const mockedStudent = Student as jest.Mocked<typeof Student>;
const teacher = authCookieFor("teacher-1", "teacher");
const student = authCookieFor("student-user-1", "student");
const studentId = "507f1f77bcf86cd799439011";
const pastDate = "2026-01-15";

beforeEach(() => {
  jest.clearAllMocks();
  mockedStudent.findOne.mockResolvedValue({ _id: studentId } as any); // accessible by default
});

describe("POST /api/classes/toggle", () => {
  const toggle = (body: object, cookie = teacher) => request(app).post("/api/classes/toggle").set("Cookie", cookie).send(body);

  it("first tap on an empty day marks the student present", async () => {
    mockedSession.findOne.mockResolvedValue(null as any);
    mockedSession.findOneAndUpdate.mockResolvedValue({ _id: "c1", date: pastDate, status: "completed" } as any);

    const res = await toggle({ student: studentId, date: pastDate });

    expect(res.status).toBe(201);
    expect(res.body.present).toBe(true);
    expect(mockedSession.findOneAndUpdate).toHaveBeenCalledWith(
      { student: studentId, date: pastDate },
      { student: studentId, date: pastDate, status: "completed" },
      expect.objectContaining({ upsert: true })
    );
  });

  it("tapping a present day removes the mark", async () => {
    mockedSession.findOne.mockResolvedValue({ _id: "c1", status: "completed" } as any);
    mockedSession.deleteOne.mockResolvedValue({} as any);

    const res = await toggle({ student: studentId, date: pastDate });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ present: false });
    expect(mockedSession.deleteOne).toHaveBeenCalledWith({ _id: "c1" });
    expect(mockedSession.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("an older scheduled/cancelled record becomes present (updated in place, never duplicated)", async () => {
    mockedSession.findOne.mockResolvedValue({ _id: "c1", status: "scheduled" } as any);
    mockedSession.findOneAndUpdate.mockResolvedValue({ _id: "c1", status: "completed" } as any);

    const res = await toggle({ student: studentId, date: pastDate });

    expect(res.status).toBe(200);
    expect(res.body.present).toBe(true);
    expect(mockedSession.deleteOne).not.toHaveBeenCalled();
  });

  it("a double-tap race on the unique index is treated as already present", async () => {
    mockedSession.findOne.mockResolvedValue(null as any);
    mockedSession.findOneAndUpdate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));

    const res = await toggle({ student: studentId, date: pastDate });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ present: true });
  });

  it("can't mark a future date", async () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const res = await toggle({ student: studentId, date: future });
    expect(res.status).toBe(400);
  });

  it("can mark today", async () => {
    mockedSession.findOne.mockResolvedValue(null as any);
    mockedSession.findOneAndUpdate.mockResolvedValue({} as any);
    const res = await toggle({ student: studentId, date: todayDhakaStr() });
    expect(res.status).toBe(201);
  });

  it("404s for a student outside the teacher's scope", async () => {
    mockedStudent.findOne.mockResolvedValue(null as any);
    const res = await toggle({ student: studentId, date: pastDate });
    expect(res.status).toBe(404);
    expect(mockedStudent.findOne).toHaveBeenCalledWith({ _id: studentId, teacher: "teacher-1" });
    expect(mockedSession.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("students can't mark attendance", async () => {
    const res = await toggle({ student: studentId, date: pastDate }, student);
    expect(res.status).toBe(403);
  });

  it("400s on a malformed date", async () => {
    const res = await toggle({ student: studentId, date: "15-01-2026" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/classes", () => {
  it("a student can read their own attendance", async () => {
    mockedSession.find.mockReturnValue(mockQuery([{ date: pastDate, status: "completed" }]));
    const res = await request(app).get("/api/classes").query({ student: studentId }).set("Cookie", student);
    expect(res.status).toBe(200);
    expect(mockedStudent.findOne).toHaveBeenCalledWith({ _id: studentId, user: "student-user-1" });
  });

  it("404s reading someone else's attendance", async () => {
    mockedStudent.findOne.mockResolvedValue(null as any);
    const res = await request(app).get("/api/classes").query({ student: studentId }).set("Cookie", student);
    expect(res.status).toBe(404);
    expect(mockedSession.find).not.toHaveBeenCalled();
  });

  it("without ?student, only the caller's students are included", async () => {
    mockedStudent.find.mockReturnValue(mockQuery([{ _id: "s1" }, { _id: "s2" }]));
    mockedSession.find.mockReturnValue(mockQuery([]));

    await request(app).get("/api/classes").query({ month: 9, year: 2026 }).set("Cookie", teacher);

    expect(mockedStudent.find).toHaveBeenCalledWith({ teacher: "teacher-1" });
    expect(mockedSession.find).toHaveBeenCalledWith({
      student: { $in: ["s1", "s2"] },
      date: { $gte: "2026-09-01", $lte: "2026-09-30" },
    });
  });
});
