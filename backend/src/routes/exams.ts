import { Router } from "express";
import { z } from "zod";
import ExamResult from "../models/ExamResult";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { isValidDateStr } from "../utils/dateUtils";
import { findAccessibleStudent, accessibleStudentIds } from "../utils/access";

const router = Router();
router.use(requireAuth);

const examSchema = z.object({
  student: z.string().refine(isValidObjectId, "Invalid student id"),
  examName: z.string().min(1),
  subject: z.string().min(1),
  examDate: z.string().refine(isValidDateStr, "Invalid date"),
  totalMarks: z.number().positive(),
  obtainedMarks: z.number().min(0),
  comments: z.string().optional(),
}).refine((d) => d.obtainedMarks <= d.totalMarks, {
  message: "Obtained marks cannot exceed total marks",
  path: ["obtainedMarks"],
});

const updateSchema = z.object({
  examName: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  examDate: z.string().refine(isValidDateStr, "Invalid date").optional(),
  totalMarks: z.number().positive().optional(),
  obtainedMarks: z.number().min(0).optional(),
  comments: z.string().optional(),
});

router.get("/", async (req: AuthedRequest, res) => {
  const { student } = req.query as { student?: string };
  const filter: Record<string, unknown> = {};
  if (student) {
    if (!isValidObjectId(student)) return res.status(400).json({ error: "Invalid student id" });
    if (!(await findAccessibleStudent(req.user!, student))) return res.status(404).json({ error: "Student not found" });
    filter.student = student;
  } else {
    filter.student = { $in: await accessibleStudentIds(req.user!) };
  }
  const exams = await ExamResult.find(filter).sort({ examDate: -1 });
  res.json(exams);
});

// Results are recorded by the teacher; students only read them.
router.post("/", requireRole("admin", "teacher"), validateBody(examSchema), async (req: AuthedRequest, res) => {
  if (!(await findAccessibleStudent(req.user!, req.body.student))) {
    return res.status(404).json({ error: "Student not found" });
  }
  const exam = await ExamResult.create(req.body);
  res.status(201).json(exam);
});

router.patch("/:id", requireRole("admin", "teacher"), validateBody(updateSchema), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const exam = await ExamResult.findById(req.params.id);
  if (!exam || !(await findAccessibleStudent(req.user!, exam.student.toString()))) {
    return res.status(404).json({ error: "Exam result not found" });
  }
  exam.set(req.body);
  await exam.save();
  res.json(exam);
});

router.delete("/:id", requireRole("admin", "teacher"), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const exam = await ExamResult.findById(req.params.id);
  if (!exam || !(await findAccessibleStudent(req.user!, exam.student.toString()))) {
    return res.status(404).json({ error: "Exam result not found" });
  }
  await ExamResult.deleteOne({ _id: exam._id });
  res.json({ ok: true });
});

export default router;
