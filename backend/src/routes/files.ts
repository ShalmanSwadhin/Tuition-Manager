import { Router } from "express";
import multer from "multer";
import StudentFile from "../models/StudentFile";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { isValidObjectId } from "../middleware/validate";
import { findAccessibleStudent } from "../utils/access";
import { saveFile, openFile, deleteFile } from "../utils/fileStore";

const router = Router();
router.use(requireAuth);

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

// Only these open in the browser; everything else downloads, so an uploaded
// .html or .svg can never run script on the app's own origin.
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

// GET /api/files?student=id
router.get("/", async (req: AuthedRequest, res) => {
  const { student } = req.query as { student?: string };
  if (!student || !(await findAccessibleStudent(req.user!, student))) {
    return res.status(404).json({ error: "Student not found" });
  }
  const files = await StudentFile.find({ student }).sort({ createdAt: -1 }).populate("uploadedBy", "name");
  res.json(files);
});

// multipart/form-data: file, student, note?
router.post(
  "/",
  requireRole("admin", "teacher"),
  (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: `File is too large (max ${MAX_UPLOAD_MB} MB)` });
      }
      if (err) return next(err);
      next();
    });
  },
  async (req: AuthedRequest, res) => {
    const file = req.file;
    const studentId = String(req.body?.student || "");
    if (!file) return res.status(400).json({ error: "Choose a file to upload" });
    if (!(await findAccessibleStudent(req.user!, studentId))) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Multer decodes multipart filenames as latin1; re-decode as UTF-8 so
    // Bangla (or any non-ASCII) names survive.
    const filename = Buffer.from(file.originalname, "latin1").toString("utf8");
    const contentType = file.mimetype || "application/octet-stream";
    const note = typeof req.body.note === "string" && req.body.note.trim() ? req.body.note.trim() : undefined;

    const gridId = await saveFile(file.buffer, filename, contentType);
    try {
      const doc = await StudentFile.create({
        student: studentId,
        uploadedBy: req.user!.id,
        filename,
        contentType,
        size: file.size,
        note,
        gridId,
      });
      res.status(201).json(doc);
    } catch (err) {
      await deleteFile(gridId);
      throw err;
    }
  }
);

// GET /api/files/:id/download   (?download=1 forces a download even for images/PDFs)
router.get("/:id/download", async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const file = await StudentFile.findById(req.params.id);
  if (!file || !(await findAccessibleStudent(req.user!, file.student.toString()))) {
    return res.status(404).json({ error: "File not found" });
  }

  const inline = INLINE_TYPES.has(file.contentType) && req.query.download !== "1";
  const asciiName = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  res.setHeader("Content-Type", inline ? file.contentType : "application/octet-stream");
  res.setHeader("Content-Length", String(file.size));
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`
  );
  res.setHeader("Cache-Control", "private, max-age=3600");

  const stream = openFile(file.gridId);
  stream.on("error", (err) => {
    if (!res.headersSent) res.status(404).json({ error: "File data missing" });
    else res.destroy(err);
  });
  stream.pipe(res);
});

router.delete("/:id", requireRole("admin", "teacher"), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const file = await StudentFile.findById(req.params.id);
  if (!file || !(await findAccessibleStudent(req.user!, file.student.toString()))) {
    return res.status(404).json({ error: "File not found" });
  }
  await deleteFile(file.gridId);
  await StudentFile.deleteOne({ _id: file._id });
  res.json({ ok: true });
});

export default router;
