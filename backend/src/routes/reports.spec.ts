process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import DiaryEntry from "../models/DiaryEntry";
import { authCookieFor } from "../test-utils/authCookie";

jest.mock("../models/Student");
jest.mock("../models/ClassSession");
jest.mock("../models/DiaryEntry");

const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedSession = ClassSession as jest.Mocked<typeof ClassSession>;
const mockedDiary = DiaryEntry as jest.Mocked<typeof DiaryEntry>;
const cookie = authCookieFor("admin-1");

function statusList(n: number, status: string) {
  return Array.from({ length: n }, () => ({ status }));
}

beforeEach(() => jest.clearAllMocks());

it("400s without year/month", async () => {
  const res = await request(app).get("/api/reports/monthly").set("Cookie", cookie);
  expect(res.status).toBe(400);
});

it("acceptance scenario 1: target 12, 8 completed -> remaining 4", async () => {
  mockedStudent.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue([{ _id: "s1", fullName: "Alice", monthlyClassTarget: 12 }]),
  } as any);
  mockedSession.find.mockResolvedValue([...statusList(8, "completed"), ...statusList(3, "scheduled")] as any);
  mockedDiary.countDocuments.mockResolvedValue(0 as any);

  const res = await request(app).get("/api/reports/monthly").query({ year: 2026, month: 9 }).set("Cookie", cookie);

  expect(res.status).toBe(200);
  expect(res.body.students[0]).toMatchObject({
    monthlyClassTarget: 12,
    completed: 8,
    remaining: 4,
    completionPercent: 66.7,
  });
});

it("acceptance scenario 2: target 16, 10 completed -> remaining 6", async () => {
  mockedStudent.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue([{ _id: "s2", fullName: "Bilal", monthlyClassTarget: 16 }]),
  } as any);
  mockedSession.find.mockResolvedValue(statusList(10, "completed") as any);
  mockedDiary.countDocuments.mockResolvedValue(0 as any);

  const res = await request(app).get("/api/reports/monthly").query({ year: 2026, month: 9 }).set("Cookie", cookie);

  expect(res.body.students[0]).toMatchObject({ completed: 10, remaining: 6 });
});

it("scheduled and cancelled classes never count toward completed", async () => {
  mockedStudent.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue([{ _id: "s3", fullName: "Cara", monthlyClassTarget: 10 }]),
  } as any);
  mockedSession.find.mockResolvedValue([...statusList(5, "scheduled"), ...statusList(5, "cancelled")] as any);
  mockedDiary.countDocuments.mockResolvedValue(0 as any);

  const res = await request(app).get("/api/reports/monthly").query({ year: 2026, month: 9 }).set("Cookie", cookie);

  expect(res.body.students[0].completed).toBe(0);
  expect(res.body.students[0].remaining).toBe(10);
});

it("supports a month where completed exceeds the target without a negative remaining", async () => {
  mockedStudent.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue([{ _id: "s4", fullName: "Dina", monthlyClassTarget: 8 }]),
  } as any);
  mockedSession.find.mockResolvedValue(statusList(11, "completed") as any);
  mockedDiary.countDocuments.mockResolvedValue(0 as any);

  const res = await request(app).get("/api/reports/monthly").query({ year: 2026, month: 9 }).set("Cookie", cookie);

  expect(res.body.students[0]).toMatchObject({ completed: 11, remaining: 0, completionPercent: 137.5 });
});
