process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import DiaryEntry from "../models/DiaryEntry";
import User from "../models/User";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";
import { todayDhakaStr } from "../utils/dateUtils";

jest.mock("../models/Student");
jest.mock("../models/ClassSession");
jest.mock("../models/DiaryEntry");
jest.mock("../models/User");

const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedSession = ClassSession as jest.Mocked<typeof ClassSession>;
const mockedDiary = DiaryEntry as jest.Mocked<typeof DiaryEntry>;
const mockedUser = User as jest.Mocked<typeof User>;
const teacher = authCookieFor("teacher-1", "teacher");
const today = todayDhakaStr();
const earlier = `${today.slice(0, 8)}01` === today ? today : `${today.slice(0, 8)}01`;

function present(studentId: string, n: number, date = earlier) {
  return Array.from({ length: n }, () => ({ student: { toString: () => studentId }, date, status: "completed" }));
}

beforeEach(() => {
  jest.clearAllMocks();

  const students = [
    { _id: { toString: () => "s1" }, fullName: "Alice", classGrade: "5", color: "#111", monthlyClassTarget: 12, user: "u1" },
    { _id: { toString: () => "s2" }, fullName: "Bilal", classGrade: "6", color: "#222", monthlyClassTarget: 5 },
    { _id: { toString: () => "s3" }, fullName: "Cara", classGrade: "7", color: "#333", monthlyClassTarget: 6 },
  ];
  mockedStudent.find.mockReturnValue(mockQuery(students));

  // The route asks only for completed classes this month.
  mockedSession.find.mockResolvedValue([
    ...present("s1", 7),
    ...present("s1", 1, today), // Alice was present today
    ...present("s2", 5), // exactly at target
    ...present("s3", 5),
  ] as any);

  mockedDiary.find.mockReturnValue(mockQuery([]));
  mockedUser.countDocuments.mockResolvedValue(4 as any);
});

it("401s without a cookie", async () => {
  const res = await request(app).get("/api/dashboard/summary");
  expect(res.status).toBe(401);
});

it("students can't open the dashboard", async () => {
  const res = await request(app).get("/api/dashboard/summary").set("Cookie", authCookieFor("s", "student"));
  expect(res.status).toBe(403);
});

it("only includes the teacher's own active students", async () => {
  await request(app).get("/api/dashboard/summary").set("Cookie", teacher);
  expect(mockedStudent.find).toHaveBeenCalledWith({ teacher: "teacher-1", status: "active" });
  expect(mockedSession.find).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
});

it("aggregates completed/remaining/at-target/present-today across students", async () => {
  const res = await request(app).get("/api/dashboard/summary").set("Cookie", teacher);

  expect(res.status).toBe(200);
  expect(res.body.today).toBe(today);
  expect(res.body.totals).toMatchObject({
    activeStudents: 3,
    completedThisMonth: 18, // 8 + 5 + 5
    remainingThisMonth: 5, // (12+5+6) - 18
    studentsAtTarget: 1, // only s2 (5/5)
    presentToday: 1,
  });
  expect(res.body.totals.teachers).toBeUndefined();

  const alice = res.body.studentCards.find((c: any) => c.fullName === "Alice");
  expect(alice).toMatchObject({ completed: 8, presentToday: true, hasAccount: true });
  const bilal = res.body.studentCards.find((c: any) => c.fullName === "Bilal");
  expect(bilal).toMatchObject({ presentToday: false, hasAccount: false });
});

it("admin sees every student plus a teacher count", async () => {
  const res = await request(app).get("/api/dashboard/summary").set("Cookie", authCookieFor("a", "admin"));
  expect(mockedStudent.find).toHaveBeenCalledWith({ status: "active" });
  expect(res.body.totals.teachers).toBe(4);
});
