process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import Student from "../models/Student";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";

jest.mock("../models/Student");

const mockedStudent = Student as jest.Mocked<typeof Student>;
const admin = authCookieFor("admin-1", "admin");
const teacher = authCookieFor("teacher-1", "teacher");
const student = authCookieFor("student-user-1", "student");
const id = "507f1f77bcf86cd799439099";

beforeEach(() => jest.clearAllMocks());

it("401s without a cookie", async () => {
  const res = await request(app).get("/api/students");
  expect(res.status).toBe(401);
});

describe("who sees which students", () => {
  beforeEach(() => mockedStudent.find.mockReturnValue(mockQuery([])));

  it("a teacher's list is limited to their own students", async () => {
    await request(app).get("/api/students").set("Cookie", teacher);
    expect(mockedStudent.find).toHaveBeenCalledWith(expect.objectContaining({ teacher: "teacher-1" }));
  });

  it("a student only ever sees their own profile", async () => {
    await request(app).get("/api/students").set("Cookie", student);
    expect(mockedStudent.find).toHaveBeenCalledWith(expect.objectContaining({ user: "student-user-1" }));
  });

  it("admin sees everyone, and can filter by teacher", async () => {
    await request(app).get("/api/students").set("Cookie", admin);
    expect(mockedStudent.find).toHaveBeenLastCalledWith({});

    await request(app).get("/api/students").query({ teacher: id }).set("Cookie", admin);
    expect(mockedStudent.find).toHaveBeenLastCalledWith({ teacher: id });
  });

  it("a teacher can't widen their scope with ?teacher=", async () => {
    await request(app).get("/api/students").query({ teacher: id }).set("Cookie", teacher);
    expect(mockedStudent.find).toHaveBeenCalledWith({ teacher: "teacher-1" });
  });

  it("opening another teacher's student 404s (scope is part of the query)", async () => {
    mockedStudent.findOne.mockReturnValue(mockQuery(null));
    const res = await request(app).get(`/api/students/${id}`).set("Cookie", teacher);
    expect(res.status).toBe(404);
    expect(mockedStudent.findOne).toHaveBeenCalledWith({ _id: id, teacher: "teacher-1" });
  });

  it("search is a case-insensitive, regex-escaped match on fullName", async () => {
    await request(app).get("/api/students").query({ search: "a+b" }).set("Cookie", teacher);
    expect(mockedStudent.find).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: { $regex: "a\\+b", $options: "i" } })
    );
  });
});

describe("creating students", () => {
  it("400s with no monthlyClassTarget", async () => {
    const res = await request(app)
      .post("/api/students")
      .set("Cookie", teacher)
      .send({ fullName: "Rafi", classGrade: "8", joiningDate: "2026-09-01" });
    expect(res.status).toBe(400);
  });

  it("a teacher's new student is always theirs, with independently configured targets (8, 12, 16)", async () => {
    for (const target of [8, 12, 16]) {
      mockedStudent.create.mockResolvedValueOnce({ fullName: `Student${target}`, monthlyClassTarget: target } as any);
      const res = await request(app)
        .post("/api/students")
        .set("Cookie", teacher)
        .send({ fullName: `Student${target}`, classGrade: "8", monthlyClassTarget: target, joiningDate: "2026-09-01" });
      expect(res.status).toBe(201);
      expect(res.body.monthlyClassTarget).toBe(target);
    }
    expect(mockedStudent.create).toHaveBeenCalledWith(expect.objectContaining({ teacher: "teacher-1" }));
  });

  it("students can't create student profiles", async () => {
    const res = await request(app)
      .post("/api/students")
      .set("Cookie", student)
      .send({ fullName: "X", classGrade: "8", monthlyClassTarget: 8, joiningDate: "2026-09-01" });
    expect(res.status).toBe(403);
  });
});

describe("updating and archiving", () => {
  it("students can't edit their own profile (e.g. their monthly target)", async () => {
    const res = await request(app).patch(`/api/students/${id}`).set("Cookie", student).send({ monthlyClassTarget: 1 });
    expect(res.status).toBe(403);
  });

  it("404s updating a student outside the teacher's scope", async () => {
    mockedStudent.findOneAndUpdate.mockResolvedValue(null as any);
    const res = await request(app).patch(`/api/students/${id}`).set("Cookie", teacher).send({ fullName: "New name" });
    expect(res.status).toBe(404);
    expect(mockedStudent.findOneAndUpdate).toHaveBeenCalledWith({ _id: id, teacher: "teacher-1" }, { fullName: "New name" }, expect.anything());
  });

  it("the teacher/user links can't be changed through PATCH", async () => {
    mockedStudent.findOneAndUpdate.mockResolvedValue({ _id: id } as any);
    await request(app).patch(`/api/students/${id}`).set("Cookie", teacher).send({ fullName: "A", teacher: "someone-else", user: "x" });
    expect(mockedStudent.findOneAndUpdate).toHaveBeenCalledWith(expect.anything(), { fullName: "A" }, expect.anything());
  });

  it("default delete archives rather than removing the student", async () => {
    mockedStudent.findOneAndUpdate.mockResolvedValue({ _id: id, status: "archived" } as any);

    const res = await request(app).delete(`/api/students/${id}`).set("Cookie", teacher);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("archived");
    expect(mockedStudent.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, teacher: "teacher-1" },
      { status: "archived" },
      expect.objectContaining({ new: true })
    );
    expect(mockedStudent.findOneAndDelete).not.toHaveBeenCalled();
  });

  it("hard=true actually deletes the student document", async () => {
    mockedStudent.findOneAndDelete.mockResolvedValue({ _id: id } as any);

    const res = await request(app).delete(`/api/students/${id}`).query({ hard: "true" }).set("Cookie", admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, deleted: true });
    expect(mockedStudent.findOneAndDelete).toHaveBeenCalledWith({ _id: id });
  });
});
