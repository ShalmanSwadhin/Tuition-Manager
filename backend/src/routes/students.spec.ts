process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../app";
import Student from "../models/Student";
import { authCookieFor } from "../test-utils/authCookie";

jest.mock("../models/Student");

const mockedStudent = Student as jest.Mocked<typeof Student>;
const cookie = authCookieFor("admin-1");

beforeEach(() => jest.clearAllMocks());

it("401s without a cookie", async () => {
  const res = await request(app).get("/api/students");
  expect(res.status).toBe(401);
});

it("400s creating a student with no monthlyClassTarget", async () => {
  const res = await request(app)
    .post("/api/students")
    .set("Cookie", cookie)
    .send({ fullName: "Rafi", classGrade: "8", joiningDate: "2026-09-01" });
  expect(res.status).toBe(400);
});

it("creates students with different, independently configured targets (8, 12, 16)", async () => {
  for (const target of [8, 12, 16]) {
    mockedStudent.create.mockResolvedValueOnce({ fullName: `Student${target}`, monthlyClassTarget: target } as any);
    const res = await request(app)
      .post("/api/students")
      .set("Cookie", cookie)
      .send({ fullName: `Student${target}`, classGrade: "8", monthlyClassTarget: target, joiningDate: "2026-09-01" });
    expect(res.status).toBe(201);
    expect(res.body.monthlyClassTarget).toBe(target);
  }
});

it("default delete archives rather than removing the student", async () => {
  mockedStudent.findByIdAndUpdate.mockResolvedValue({ _id: "s1", status: "archived" } as any);

  const res = await request(app).delete("/api/students/507f1f77bcf86cd799439099").set("Cookie", cookie);

  expect(res.status).toBe(200);
  expect(res.body.status).toBe("archived");
  expect(mockedStudent.findByIdAndUpdate).toHaveBeenCalledWith(
    "507f1f77bcf86cd799439099",
    { status: "archived" },
    expect.objectContaining({ new: true })
  );
  expect(mockedStudent.findByIdAndDelete).not.toHaveBeenCalled();
});

it("hard=true actually deletes the student document", async () => {
  mockedStudent.findByIdAndDelete.mockResolvedValue({ _id: "s1" } as any);

  const res = await request(app)
    .delete("/api/students/507f1f77bcf86cd799439099")
    .query({ hard: "true" })
    .set("Cookie", cookie);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true, deleted: true });
  expect(mockedStudent.findByIdAndDelete).toHaveBeenCalledWith("507f1f77bcf86cd799439099");
});

it("404s updating a student that doesn't exist", async () => {
  mockedStudent.findByIdAndUpdate.mockResolvedValue(null as any);
  const res = await request(app)
    .patch("/api/students/507f1f77bcf86cd799439099")
    .set("Cookie", cookie)
    .send({ fullName: "New name" });
  expect(res.status).toBe(404);
});

it("search filters by fullName with a case-insensitive regex", async () => {
  const sortMock = jest.fn().mockResolvedValue([]);
  mockedStudent.find.mockReturnValue({ sort: sortMock } as any);

  await request(app).get("/api/students").query({ search: "ali" }).set("Cookie", cookie);

  expect(mockedStudent.find).toHaveBeenCalledWith(
    expect.objectContaining({ fullName: { $regex: "ali", $options: "i" } })
  );
});
