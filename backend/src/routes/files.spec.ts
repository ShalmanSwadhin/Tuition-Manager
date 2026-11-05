process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

import request from "supertest";
import { Readable } from "stream";
import app from "../app";
import StudentFile from "../models/StudentFile";
import Student from "../models/Student";
import * as fileStore from "../utils/fileStore";
import { authCookieFor } from "../test-utils/authCookie";
import { mockQuery } from "../test-utils/mockQuery";

jest.mock("../models/StudentFile");
jest.mock("../models/Student");
jest.mock("../utils/fileStore");

const mockedFile = StudentFile as jest.Mocked<typeof StudentFile>;
const mockedStudent = Student as jest.Mocked<typeof Student>;
const store = fileStore as jest.Mocked<typeof fileStore>;
const teacher = authCookieFor("teacher-1", "teacher");
const student = authCookieFor("student-user-1", "student");
const studentId = "507f1f77bcf86cd799439011";
const fileId = "507f1f77bcf86cd799439099";

function fileDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: fileId,
    student: { toString: () => studentId },
    filename: "notes.pdf",
    contentType: "application/pdf",
    size: 5,
    gridId: "grid-1",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedStudent.findOne.mockResolvedValue({ _id: studentId } as any); // accessible by default
  store.saveFile.mockResolvedValue("grid-1" as any);
  store.deleteFile.mockResolvedValue();
});

describe("uploading", () => {
  it("a teacher uploads a file for their student", async () => {
    mockedFile.create.mockImplementation(async (doc: any) => doc);

    const res = await request(app)
      .post("/api/files")
      .set("Cookie", teacher)
      .field("student", studentId)
      .field("note", " Read before class ")
      .attach("file", Buffer.from("hello"), { filename: "slides.pptx", contentType: "application/vnd.ms-powerpoint" });

    expect(res.status).toBe(201);
    expect(store.saveFile).toHaveBeenCalledWith(expect.any(Buffer), "slides.pptx", "application/vnd.ms-powerpoint");
    expect(mockedFile.create).toHaveBeenCalledWith(
      expect.objectContaining({ student: studentId, uploadedBy: "teacher-1", filename: "slides.pptx", size: 5, note: "Read before class", gridId: "grid-1" })
    );
    expect(mockedStudent.findOne).toHaveBeenCalledWith({ _id: studentId, teacher: "teacher-1" });
  });

  it("keeps non-ASCII (e.g. Bangla) filenames intact", async () => {
    mockedFile.create.mockImplementation(async (doc: any) => doc);
    const res = await request(app)
      .post("/api/files")
      .set("Cookie", teacher)
      .field("student", studentId)
      .attach("file", Buffer.from("x"), { filename: "অধ্যায় ৩.pdf", contentType: "application/pdf" });
    expect(res.body.filename).toBe("অধ্যায় ৩.pdf");
  });

  it("404s for another teacher's student and stores nothing", async () => {
    mockedStudent.findOne.mockResolvedValue(null as any);
    const res = await request(app)
      .post("/api/files")
      .set("Cookie", teacher)
      .field("student", studentId)
      .attach("file", Buffer.from("x"), "a.txt");
    expect(res.status).toBe(404);
    expect(store.saveFile).not.toHaveBeenCalled();
  });

  it("students can't upload", async () => {
    const res = await request(app).post("/api/files").set("Cookie", student).field("student", studentId).attach("file", Buffer.from("x"), "a.txt");
    expect(res.status).toBe(403);
  });

  it("400s without a file", async () => {
    const res = await request(app).post("/api/files").set("Cookie", teacher).field("student", studentId);
    expect(res.status).toBe(400);
  });

  it("removes the stored bytes if saving the metadata fails", async () => {
    mockedFile.create.mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/api/files").set("Cookie", teacher).field("student", studentId).attach("file", Buffer.from("x"), "a.txt");
    expect(res.status).toBe(500);
    expect(store.deleteFile).toHaveBeenCalledWith("grid-1");
  });
});

describe("listing and downloading", () => {
  it("a student lists their own files", async () => {
    mockedFile.find.mockReturnValue(mockQuery([fileDoc()]));
    const res = await request(app).get("/api/files").query({ student: studentId }).set("Cookie", student);
    expect(res.status).toBe(200);
    expect(mockedStudent.findOne).toHaveBeenCalledWith({ _id: studentId, user: "student-user-1" });
  });

  it("404s listing someone else's files", async () => {
    mockedStudent.findOne.mockResolvedValue(null as any);
    const res = await request(app).get("/api/files").query({ student: studentId }).set("Cookie", student);
    expect(res.status).toBe(404);
    expect(mockedFile.find).not.toHaveBeenCalled();
  });

  it("streams a PDF inline with its UTF-8 filename", async () => {
    mockedFile.findById.mockResolvedValue(fileDoc({ filename: "অধ্যায়.pdf" }) as any);
    store.openFile.mockReturnValue(Readable.from([Buffer.from("%PDF-")]));

    const res = await request(app).get(`/api/files/${fileId}/download`).set("Cookie", student);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toMatch(/^inline; filename="_+\.pdf"; filename\*=UTF-8''%E0%A6/);
    expect(res.body.toString()).toBe("%PDF-");
  });

  it("anything that could run script (html, svg, ...) is always a download", async () => {
    for (const contentType of ["text/html", "image/svg+xml", "application/javascript"]) {
      mockedFile.findById.mockResolvedValue(fileDoc({ filename: "x", contentType, size: 8 }) as any);
      store.openFile.mockReturnValue(Readable.from([Buffer.from("<script>")]));

      const res = await request(app).get(`/api/files/${fileId}/download`).set("Cookie", student);

      expect(res.headers["content-type"]).toBe("application/octet-stream");
      expect(res.headers["content-disposition"]).toMatch(/^attachment/);
    }
  });

  it("?download=1 forces a download even for a PDF", async () => {
    mockedFile.findById.mockResolvedValue(fileDoc() as any);
    store.openFile.mockReturnValue(Readable.from([Buffer.from("%PDF-")]));
    const res = await request(app).get(`/api/files/${fileId}/download?download=1`).set("Cookie", student);
    expect(res.headers["content-disposition"]).toMatch(/^attachment/);
  });

  it("404s downloading another student's file", async () => {
    mockedFile.findById.mockResolvedValue(fileDoc() as any);
    mockedStudent.findOne.mockResolvedValue(null as any);
    const res = await request(app).get(`/api/files/${fileId}/download`).set("Cookie", student);
    expect(res.status).toBe(404);
    expect(store.openFile).not.toHaveBeenCalled();
  });
});

describe("deleting", () => {
  it("a teacher deletes both the bytes and the record", async () => {
    mockedFile.findById.mockResolvedValue(fileDoc() as any);
    mockedFile.deleteOne.mockResolvedValue({} as any);
    const res = await request(app).delete(`/api/files/${fileId}`).set("Cookie", teacher);
    expect(res.status).toBe(200);
    expect(store.deleteFile).toHaveBeenCalledWith("grid-1");
    expect(mockedFile.deleteOne).toHaveBeenCalledWith({ _id: fileId });
  });

  it("students can't delete", async () => {
    const res = await request(app).delete(`/api/files/${fileId}`).set("Cookie", student);
    expect(res.status).toBe(403);
  });
});
