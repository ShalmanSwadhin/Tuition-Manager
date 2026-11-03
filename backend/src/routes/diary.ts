import { Router } from "express";
import { z } from "zod";
import DiaryEntry from "../models/DiaryEntry";
import { requireAuth } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { isValidDateStr } from "../utils/dateUtils";

const router = Router();
router.use(requireAuth);

const diarySchema = z.object({
  student: z.string().refine(isValidObjectId, "Invalid student id"),
  date: z.string().refine(isValidDateStr, "Invalid date"),
  subject: z.string().min(1),
  topic: z.string().optional(),
  taughtToday: z.string().optional(),
  homework: z.string().optional(),
  nextPrep: z.string().optional(),
  notes: z.string().optional(),
  homeworkStatus: z.enum(["pending", "completed"]).optional(),
});

const updateSchema = diarySchema.partial();

// GET /api/diary?student=id&date=2026-09-10&subject=Math
router.get("/", async (req, res) => {
  const { student, date, subject } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (student) {
    if (!isValidObjectId(student)) return res.status(400).json({ error: "Invalid student id" });
    filter.student = student;
  }
  if (date) filter.date = date;
  if (subject) filter.subject = { $regex: subject, $options: "i" };
  const entries = await DiaryEntry.find(filter).sort({ date: -1, createdAt: -1 });
  res.json(entries);
});

router.post("/", validateBody(diarySchema), async (req, res) => {
  const entry = await DiaryEntry.create(req.body);
  res.status(201).json(entry);
});

router.patch("/:id", validateBody(updateSchema), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const entry = await DiaryEntry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!entry) return res.status(404).json({ error: "Diary entry not found" });
  res.json(entry);
});

router.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const entry = await DiaryEntry.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ error: "Diary entry not found" });
  res.json({ ok: true });
});

export default router;
