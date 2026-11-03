import { Router } from "express";
import { z } from "zod";
import ClassSession from "../models/ClassSession";
import Student from "../models/Student";
import { requireAuth } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { monthBounds, isValidDateStr } from "../utils/dateUtils";

const router = Router();
router.use(requireAuth);

const classSchema = z.object({
  student: z.string().refine(isValidObjectId, "Invalid student id"),
  date: z.string().refine(isValidDateStr, "Invalid date"),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("completed"),
  note: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

const updateSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  note: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

// GET /api/classes?student=id&month=9&year=2026  (both optional)
// GET /api/classes?from=2026-09-01&to=2026-09-30  (global calendar range)
router.get("/", async (req, res) => {
  const { student, month, year, from, to } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (student) {
    if (!isValidObjectId(student)) return res.status(400).json({ error: "Invalid student id" });
    filter.student = student;
  }
  if (month && year) {
    const { start, end } = monthBounds(Number(year), Number(month));
    filter.date = { $gte: start, $lte: end };
  } else if (from && to) {
    filter.date = { $gte: from, $lte: to };
  }
  const sessions = await ClassSession.find(filter).populate("student", "fullName color").sort({ date: 1 });
  res.json(sessions);
});

// Create a NEW class record for a date that doesn't have one yet. Kept for
// completeness/back-compat; day-click flows should use /mark instead, since
// a date can only ever hold one record (see the unique index on the model).
router.post("/", validateBody(classSchema), async (req, res) => {
  const student = await Student.findById(req.body.student);
  if (!student) return res.status(404).json({ error: "Student not found" });

  try {
    const session = await ClassSession.create(req.body);
    res.status(201).json(session);
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "This student already has a class record on that date. Edit it instead." });
    }
    throw err;
  }
});

// Upsert the one class record for a given student+date. This is what the
// calendar's day-click actions (Mark Completed / Schedule / Cancel) call:
// it creates the record if the date is empty, or transitions the existing
// record's status if one is already there — never creating a duplicate.
router.post("/mark", validateBody(classSchema), async (req, res) => {
  const student = await Student.findById(req.body.student);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const { student: studentId, date, status, note, durationMinutes } = req.body;
  const existing = await ClassSession.findOne({ student: studentId, date });

  const session = await ClassSession.findOneAndUpdate(
    { student: studentId, date },
    { student: studentId, date, status, note, durationMinutes },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(existing ? 200 : 201).json(session);
});

router.patch("/:id", validateBody(updateSchema), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const session = await ClassSession.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!session) return res.status(404).json({ error: "Class record not found" });
    res.json(session);
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A class record already exists for that student and date" });
    }
    throw err;
  }
});

// Undo / remove a mistakenly marked class
router.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const session = await ClassSession.findByIdAndDelete(req.params.id);
  if (!session) return res.status(404).json({ error: "Class record not found" });
  res.json({ ok: true });
});

export default router;
