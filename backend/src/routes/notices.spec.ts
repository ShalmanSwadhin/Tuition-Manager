process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import Notice from "../models/Notice";
import Student from "../models/Student";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";

jest.mock("../models/Notice");
jest.mock("../models/Student");

const mockedNotice = Notice as jest.Mocked<typeof Notice>;
const mockedStudent = Student as jest.Mocked<typeof Student>;
const teacher = authCookieFor("teacher-1", "teacher");
const student = authCookieFor("student-user-1", "student");
const noticeId = "507f1f77bcf86cd799439099";

beforeEach(() => {
  jest.clearAllMocks();
  mockedNotice.find.mockReturnValue(mockQuery([]));
});

it("a teacher posts a notice as themselves", async () => {
  mockedNotice.create.mockImplementation(async (doc: any) => doc);
  const res = await request(app).post("/api/notices").set("Cookie", teacher).send({ title: "No class Friday", body: "Eid" });
  expect(res.status).toBe(201);
  expect(mockedNotice.create).toHaveBeenCalledWith({ title: "No class Friday", body: "Eid", teacher: "teacher-1" });
});

it("needs a title", async () => {
  const res = await request(app).post("/api/notices").set("Cookie", teacher).send({ title: "  " });
  expect(res.status).toBe(400);
});

it("students can't post", async () => {
  const res = await request(app).post("/api/notices").set("Cookie", student).send({ title: "x" });
  expect(res.status).toBe(403);
});

it("a teacher only lists their own notices", async () => {
  await request(app).get("/api/notices").set("Cookie", teacher);
  expect(mockedNotice.find).toHaveBeenCalledWith({ teacher: "teacher-1" });
});

it("a student sees their own teacher's notices", async () => {
  mockedStudent.findOne.mockReturnValue(mockQuery({ teacher: "teacher-9" }));
  await request(app).get("/api/notices").set("Cookie", student);
  expect(mockedStudent.findOne).toHaveBeenCalledWith({ user: "student-user-1" });
  expect(mockedNotice.find).toHaveBeenCalledWith({ teacher: "teacher-9" });
});

it("admin sees every notice", async () => {
  await request(app).get("/api/notices").set("Cookie", authCookieFor("a", "admin"));
  expect(mockedNotice.find).toHaveBeenCalledWith({});
});

it("a teacher can only delete their own notice", async () => {
  mockedNotice.findOneAndDelete.mockResolvedValue(null as any);
  const res = await request(app).delete(`/api/notices/${noticeId}`).set("Cookie", teacher);
  expect(res.status).toBe(404);
  expect(mockedNotice.findOneAndDelete).toHaveBeenCalledWith({ _id: noticeId, teacher: "teacher-1" });
});
