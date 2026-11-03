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

function repeat(studentId: string, status: string, n: number) {
  return Array.from({ length: n }, () => ({ student: { toString: () => studentId }, status }));
}

beforeEach(() => {
  jest.clearAllMocks();

  const students = [
    { _id: { toString: () => "s1" }, fullName: "Alice", classGrade: "5", color: "#111", monthlyClassTarget: 12 },
    { _id: { toString: () => "s2" }, fullName: "Bilal", classGrade: "6", color: "#222", monthlyClassTarget: 5 },
    { _id: { toString: () => "s3" }, fullName: "Cara", classGrade: "7", color: "#333", monthlyClassTarget: 6 },
  ];
  mockedStudent.find.mockResolvedValue(students as any);

  const monthSessions = [
    ...repeat("s1", "completed", 8),
    ...repeat("s1", "scheduled", 2), // noise -- must not count
    ...repeat("s2", "completed", 5), // exactly at target
    ...repeat("s3", "completed", 5), // approaching: target 6, done 5
  ];

  (mockedSession.find as jest.Mock).mockImplementation((filter: any) => {
    if (filter && filter.status) {
      // the "today's schedule" query, which chains .populate()
      return { populate: jest.fn().mockResolvedValue([]) } as any;
    }
    return Promise.resolve(monthSessions) as any;
  });

  mockedDiary.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([]),
      }),
    }),
  } as any);
});

it("401s without a cookie", async () => {
  const res = await request(app).get("/api/dashboard/summary");
  expect(res.status).toBe(401);
});

it("aggregates completed/remaining/at-target/approaching correctly across students", async () => {
  const res = await request(app).get("/api/dashboard/summary").set("Cookie", cookie);

  expect(res.status).toBe(200);
  expect(res.body.totals).toMatchObject({
    activeStudents: 3,
    completedThisMonth: 18, // 8 + 5 + 5; scheduled noise excluded
    remainingThisMonth: 5, // (12+5+6) - 18
    studentsAtTarget: 1, // only s2 (5/5)
  });

  expect(res.body.approachingLimit).toHaveLength(1);
  expect(res.body.approachingLimit[0]).toMatchObject({ fullName: "Cara", completed: 5, target: 6 });

  const s1Card = res.body.studentCards.find((c: any) => c.fullName === "Alice");
  expect(s1Card.completed).toBe(8);
});
