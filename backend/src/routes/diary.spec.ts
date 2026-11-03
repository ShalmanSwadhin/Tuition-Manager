process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import DiaryEntry from "../models/DiaryEntry";
import { authCookieFor } from "../test-utils/authCookie";

jest.mock("../models/DiaryEntry");

const mockedDiary = DiaryEntry as jest.Mocked<typeof DiaryEntry>;
const cookie = authCookieFor("admin-1");
const studentId = "507f1f77bcf86cd799439011";

beforeEach(() => jest.clearAllMocks());

it("401s without a cookie", async () => {
  const res = await request(app).get("/api/diary");
  expect(res.status).toBe(401);
});

it("400s if subject is missing (required field)", async () => {
  const res = await request(app)
    .post("/api/diary")
    .set("Cookie", cookie)
    .send({ student: studentId, date: "2026-09-10" });
  expect(res.status).toBe(400);
});

it("creates an entry with only the required fields -- optional fields are genuinely optional", async () => {
  mockedDiary.create.mockResolvedValue({
    _id: "d1",
    student: studentId,
    date: "2026-09-10",
    subject: "Math",
    homeworkStatus: "pending",
  } as any);

  const res = await request(app)
    .post("/api/diary")
    .set("Cookie", cookie)
    .send({ student: studentId, date: "2026-09-10", subject: "Math" });

  expect(res.status).toBe(201);
  expect(mockedDiary.create).toHaveBeenCalledWith(
    expect.objectContaining({ student: studentId, date: "2026-09-10", subject: "Math" })
  );
});

it("allows two entries for the same student on the same date (no uniqueness constraint)", async () => {
  mockedDiary.create.mockResolvedValueOnce({ _id: "d1", subject: "Math" } as any);
  mockedDiary.create.mockResolvedValueOnce({ _id: "d2", subject: "English" } as any);

  const first = await request(app)
    .post("/api/diary")
    .set("Cookie", cookie)
    .send({ student: studentId, date: "2026-09-10", subject: "Math" });
  const second = await request(app)
    .post("/api/diary")
    .set("Cookie", cookie)
    .send({ student: studentId, date: "2026-09-10", subject: "English" });

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(mockedDiary.create).toHaveBeenCalledTimes(2);
});

it("toggling homeworkStatus only patches that field", async () => {
  mockedDiary.findByIdAndUpdate.mockResolvedValue({ _id: "d1", homeworkStatus: "completed" } as any);

  const res = await request(app)
    .patch("/api/diary/507f1f77bcf86cd799439099")
    .set("Cookie", cookie)
    .send({ homeworkStatus: "completed" });

  expect(res.status).toBe(200);
  expect(mockedDiary.findByIdAndUpdate).toHaveBeenCalledWith(
    "507f1f77bcf86cd799439099",
    { homeworkStatus: "completed" },
    expect.objectContaining({ new: true })
  );
});

it("404s deleting a non-existent entry", async () => {
  mockedDiary.findByIdAndDelete.mockResolvedValue(null as any);
  const res = await request(app).delete("/api/diary/507f1f77bcf86cd799439099").set("Cookie", cookie);
  expect(res.status).toBe(404);
});
