process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import DiaryEntry from "../models/DiaryEntry";
import Student from "../models/Student";
import User from "../models/User";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";

jest.mock("../models/DiaryEntry");
jest.mock("../models/Student");
jest.mock("../models/User");

const mockedDiary = DiaryEntry as jest.Mocked<typeof DiaryEntry>;
const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedUser = User as jest.Mocked<typeof User>;
const teacher = authCookieFor("teacher-1", "teacher");
const student = authCookieFor("student-user-1", "student");
const studentId = "507f1f77bcf86cd799439011";
const entryId = "507f1f77bcf86cd799439099";

// A stand-in for a loaded DiaryEntry document.
function entryDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: entryId,
    student: { toString: () => studentId },
    date: "2026-09-10",
    subject: "Math",
    homework: "Ex 1.1",
    homeworkStatus: "pending",
    author: { user: { toString: () => "student-user-1" }, name: "Rafi", role: "student" },
    history: [] as any[],
    save: jest.fn().mockResolvedValue(undefined),
    toJSON() {
      const { save, toJSON, ...rest } = this as any;
      return rest;
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedStudent.findOne.mockReturnValue(mockQuery({ _id: studentId, id: studentId })); // accessible by default
  mockedUser.findById.mockReturnValue(mockQuery({ name: "Ms Rahman" }));
});

it("401s without a cookie", async () => {
  const res = await request(app).get("/api/diary");
  expect(res.status).toBe(401);
});

describe("creating entries", () => {
  it("400s if subject is missing", async () => {
    const res = await request(app).post("/api/diary").set("Cookie", teacher).send({ student: studentId, date: "2026-09-10" });
    expect(res.status).toBe(400);
  });

  it("a teacher writes into their student's diary, recorded as the author", async () => {
    mockedDiary.create.mockImplementation(async (doc: any) => doc);

    const res = await request(app)
      .post("/api/diary")
      .set("Cookie", teacher)
      .send({ student: studentId, date: "2026-09-10", subject: "Math" });

    expect(res.status).toBe(201);
    expect(mockedDiary.create).toHaveBeenCalledWith(
      expect.objectContaining({ student: studentId, subject: "Math", author: { user: "teacher-1", name: "Ms Rahman", role: "teacher" } })
    );
  });

  it("a teacher can't write into another teacher's student's diary", async () => {
    mockedStudent.findOne.mockReturnValue(mockQuery(null));
    const res = await request(app)
      .post("/api/diary")
      .set("Cookie", teacher)
      .send({ student: studentId, date: "2026-09-10", subject: "Math" });
    expect(res.status).toBe(404);
    expect(mockedDiary.create).not.toHaveBeenCalled();
  });

  it("a student always writes into their own diary, whatever `student` they send", async () => {
    mockedStudent.findOne.mockReturnValue(mockQuery({ id: "own-profile" }));
    mockedDiary.create.mockImplementation(async (doc: any) => doc);

    const res = await request(app)
      .post("/api/diary")
      .set("Cookie", student)
      .send({ student: "507f1f77bcf86cd7994390aa", date: "2026-09-10", subject: "Math" });

    expect(res.status).toBe(201);
    expect(mockedStudent.findOne).toHaveBeenCalledWith({ user: "student-user-1" });
    expect(mockedDiary.create).toHaveBeenCalledWith(expect.objectContaining({ student: "own-profile" }));
  });

  it("allows two entries for the same student on the same date", async () => {
    mockedDiary.create.mockImplementation(async (doc: any) => doc);
    for (const subject of ["Math", "English"]) {
      const res = await request(app).post("/api/diary").set("Cookie", teacher).send({ student: studentId, date: "2026-09-10", subject });
      expect(res.status).toBe(201);
    }
    expect(mockedDiary.create).toHaveBeenCalledTimes(2);
  });
});

describe("editing keeps the previous version", () => {
  it("a student editing their own entry saves the old text into history", async () => {
    const doc = entryDoc();
    mockedDiary.findById.mockResolvedValue(doc as any);

    const res = await request(app).patch(`/api/diary/${entryId}`).set("Cookie", student).send({ homework: "Ex 1.1 and 1.2" });

    expect(res.status).toBe(200);
    expect(doc.homework).toBe("Ex 1.1 and 1.2");
    expect(doc.history).toHaveLength(1);
    expect(doc.history[0]).toMatchObject({
      subject: "Math",
      homework: "Ex 1.1",
      editedBy: { user: "student-user-1", role: "student" },
    });
    expect(doc.save).toHaveBeenCalled();
  });

  it("re-sending unchanged content doesn't count as an edit", async () => {
    const doc = entryDoc();
    mockedDiary.findById.mockResolvedValue(doc as any);

    await request(app).patch(`/api/diary/${entryId}`).set("Cookie", student).send({ subject: "Math", homework: "Ex 1.1" });

    expect(doc.history).toHaveLength(0);
  });

  it("ticking homework is not an edit, and students may do it on teacher entries", async () => {
    const doc = entryDoc({ author: { user: { toString: () => "teacher-1" }, name: "Ms Rahman", role: "teacher" } });
    mockedDiary.findById.mockResolvedValue(doc as any);

    const res = await request(app).patch(`/api/diary/${entryId}`).set("Cookie", student).send({ homeworkStatus: "completed" });

    expect(res.status).toBe(200);
    expect(doc.homeworkStatus).toBe("completed");
    expect(doc.history).toHaveLength(0);
  });

  it("students can't rewrite an entry their teacher wrote", async () => {
    const doc = entryDoc({ author: { user: { toString: () => "teacher-1" }, name: "Ms Rahman", role: "teacher" } });
    mockedDiary.findById.mockResolvedValue(doc as any);

    const res = await request(app).patch(`/api/diary/${entryId}`).set("Cookie", student).send({ homework: "none" });

    expect(res.status).toBe(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it("a teacher's edit is recorded too", async () => {
    const doc = entryDoc();
    mockedDiary.findById.mockResolvedValue(doc as any);

    await request(app).patch(`/api/diary/${entryId}`).set("Cookie", teacher).send({ notes: "Checked" });

    expect(doc.history[0].editedBy).toEqual({ user: "teacher-1", name: "Ms Rahman", role: "teacher" });
  });

  it("404s an entry outside the caller's scope", async () => {
    mockedDiary.findById.mockResolvedValue(entryDoc() as any);
    mockedStudent.findOne.mockReturnValue(mockQuery(null));
    const res = await request(app).patch(`/api/diary/${entryId}`).set("Cookie", teacher).send({ notes: "x" });
    expect(res.status).toBe(404);
  });
});

describe("deleting", () => {
  it("students can't delete (so edit history can't be erased)", async () => {
    const res = await request(app).delete(`/api/diary/${entryId}`).set("Cookie", student);
    expect(res.status).toBe(403);
  });

  it("a teacher can delete their student's entry", async () => {
    mockedDiary.findById.mockResolvedValue(entryDoc() as any);
    mockedDiary.deleteOne.mockResolvedValue({} as any);
    const res = await request(app).delete(`/api/diary/${entryId}`).set("Cookie", teacher);
    expect(res.status).toBe(200);
    expect(mockedDiary.deleteOne).toHaveBeenCalledWith({ _id: entryId });
  });

  it("404s deleting a non-existent entry", async () => {
    mockedDiary.findById.mockResolvedValue(null as any);
    const res = await request(app).delete(`/api/diary/${entryId}`).set("Cookie", teacher);
    expect(res.status).toBe(404);
  });
});
