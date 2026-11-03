import { Router } from "express";
import { z } from "zod";
import ExamResult from "../models/ExamResult";
import { requireAuth } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { isValidDateStr } from "../utils/dateUtils";

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

router.get("/", async (req, res) => {
  const { student } = req.query as { student?: string };
  const filter: Record<string, unknown> = {};
  if (student) {
    if (!isValidObjectId(student)) return res.status(400).json({ error: "Invalid student id" });
    filter.student = student;
  }
  const exams = await ExamResult.find(filter).sort({ examDate: -1 });
  res.json(exams);
});

router.post("/", validateBody(examSchema), async (req, res) => {
  const exam = await ExamResult.create(req.body);
  res.status(201).json(exam);
});

router.patch("/:id", validateBody(updateSchema), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const exam = await ExamResult.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!exam) return res.status(404).json({ error: "Exam result not found" });
  res.json(exam);
});

router.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const exam = await ExamResult.findByIdAndDelete(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam result not found" });
  res.json({ ok: true });
});

export default router;
