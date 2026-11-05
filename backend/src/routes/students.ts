import { Router } from "express";
import { z } from "zod";
import Student from "../models/Student";
import DiaryEntry from "../models/DiaryEntry";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { studentScope } from "../utils/access";
import { escapeRegex } from "../utils/escapeRegex";

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
  preferredDays: z.array(z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"])).optional(),
  classTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").optional().or(z.literal("")),
  notes: z.string().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "paused", "archived"]).optional(),
  color: z.string().optional(),
  attendanceVisible: z.boolean().optional(),
});

const updateSchema = studentSchema.partial();

const visibilitySchema = z.object({ attendanceVisible: z.boolean() });

// GET /api/students?status=active&search=foo&teacher=id (teacher filter: admin only)
router.get("/", async (req: AuthedRequest, res) => {
  const { status, search, teacher } = req.query as { status?: string; search?: string; teacher?: string };
  const filter: Record<string, unknown> = { ...studentScope(req.user!) };
  if (status) filter.status = status;
  if (search) filter.fullName = { $regex: escapeRegex(search), $options: "i" };
  if (teacher && req.user!.role === "admin") {
    if (!isValidObjectId(teacher)) return res.status(400).json({ error: "Invalid teacher id" });
    filter.teacher = teacher;
  }
  const students = await Student.find(filter).sort({ fullName: 1 }).populate("teacher", "name");
  res.json(students);
});

// Teachers can add a student who has no app account (e.g. no phone); they
// show up exactly like students who signed up with the teacher's key.
router.post("/", requireRole("teacher"), validateBody(studentSchema), async (req: AuthedRequest, res) => {
  const student = await Student.create({ ...req.body, teacher: req.user!.id });
  res.status(201).json(student);
});

router.get("/:id", async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const student = await Student.findOne({ _id: req.params.id, ...studentScope(req.user!) })
    .populate("teacher", "name")
    .populate("user", "email");
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Show or hide the attendance calendar for every student in the caller's
// scope at once (a teacher's own students; everyone for admin).
router.patch(
  "/attendance-visibility",
  requireRole("admin", "teacher"),
  validateBody(visibilitySchema),
  async (req: AuthedRequest, res) => {
    const result = await Student.updateMany(studentScope(req.user!), { attendanceVisible: req.body.attendanceVisible });
    res.json({ updated: result.modifiedCount });
  }
);

router.patch("/:id", requireRole("admin", "teacher"), validateBody(updateSchema), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const student = await Student.findOneAndUpdate({ _id: req.params.id, ...studentScope(req.user!) }, req.body, {
    new: true,
    runValidators: true,
  });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Prefer archiving over hard delete; historical records are preserved either way.
router.delete("/:id", requireRole("admin", "teacher"), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const scoped = { _id: req.params.id, ...studentScope(req.user!) };
  if (req.query.hard === "true") {
    const student = await Student.findOneAndDelete(scoped);
    if (!student) return res.status(404).json({ error: "Student not found" });
    // Historical class/diary/exam records are intentionally left in place
    // even on a hard delete of the student document, per the no-data-loss rule.
    return res.json({ ok: true, deleted: true });
  }
  const student = await Student.findOneAndUpdate(scoped, { status: "archived" }, { new: true });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// Convenience: latest diary entry for the profile page
router.get("/:id/summary", async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const student = await Student.findOne({ _id: req.params.id, ...studentScope(req.user!) });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const latestDiary = await DiaryEntry.findOne({ student: student._id }).sort({ date: -1, createdAt: -1 });
  res.json({ student, latestDiary });
});

export default router;
