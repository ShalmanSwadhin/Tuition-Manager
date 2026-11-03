import { Router } from "express";
import { z } from "zod";
import Student from "../models/Student";
import ClassSession from "../models/ClassSession";
import DiaryEntry from "../models/DiaryEntry";
import { requireAuth } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";

const router = Router();
router.use(requireAuth);

const studentSchema = z.object({
  fullName: z.string().min(1),
  photoUrl: z.string().url().optional().or(z.literal("")),
  school: z.string().optional(),
  classGrade: z.string().min(1),
  subjects: z.array(z.string()).default([]),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  address: z.string().optional(),
  monthlyClassTarget: z.number().int().min(1),
  defaultClassDurationMinutes: z.number().int().positive().optional(),
  preferredDays: z.array(z.string()).optional(),
  notes: z.string().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "paused", "archived"]).optional(),
  color: z.string().optional(),
});

const updateSchema = studentSchema.partial();

// GET /api/students?status=active&search=foo
router.get("/", async (req, res) => {
  const { status, search } = req.query as { status?: string; search?: string };
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (search) filter.fullName = { $regex: search, $options: "i" };
  const students = await Student.find(filter).sort({ fullName: 1 });
  res.json(students);
});

router.post("/", validateBody(studentSchema), async (req, res) => {
  const student = await Student.create(req.body);
  res.status(201).json(student);
});

router.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

router.patch("/:id", validateBody(updateSchema), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Prefer archiving over hard delete; historical records are preserved either way.
router.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const { hard } = req.query;
  if (hard === "true") {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    // Historical class/diary/exam records are intentionally left in place
    // even on a hard delete of the student document, per the no-data-loss rule.
    return res.json({ ok: true, deleted: true });
  }
  const student = await Student.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Convenience: latest diary entry + this-month class summary for the profile page
router.get("/:id/summary", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const latestDiary = await DiaryEntry.findOne({ student: student._id }).sort({ date: -1, createdAt: -1 });
  res.json({ student, latestDiary });
});

export default router;
