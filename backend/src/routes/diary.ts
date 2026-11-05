import { Router } from "express";
import { z } from "zod";
import DiaryEntry, { DiaryActor } from "../models/DiaryEntry";
import Student from "../models/Student";
import User from "../models/User";
import { requireAuth, requireRole, AuthedRequest, AuthUser } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { isValidDateStr } from "../utils/dateUtils";
import { findAccessibleStudent, accessibleStudentIds } from "../utils/access";
import { escapeRegex } from "../utils/escapeRegex";

const router = Router();
router.use(requireAuth);

// The editable content of an entry. A snapshot of these is kept in the
// entry's `history` every time someone changes them.
const DIARY_CONTENT_FIELDS = ["date", "subject", "topic", "taughtToday", "homework", "nextPrep", "notes"] as const;

const contentSchema = z.object({
  date: z.string().refine(isValidDateStr, "Invalid date"),
  subject: z.string().trim().min(1),
  topic: z.string().optional(),
  taughtToday: z.string().optional(),
  homework: z.string().optional(),
  nextPrep: z.string().optional(),
  notes: z.string().optional(),
});

// Students always write to their own diary, so they may omit `student`.
const createSchema = contentSchema.extend({
  student: z.string().refine(isValidObjectId, "Invalid student id").optional(),
  homeworkStatus: z.enum(["pending", "completed"]).optional(),
});

const updateSchema = contentSchema.partial().extend({
  homeworkStatus: z.enum(["pending", "completed"]).optional(),
});

async function actorFor(user: AuthUser): Promise<DiaryActor> {
  const u = await User.findById(user.id).select("name");
  return { user: user.id as any, name: u?.name || "Unknown", role: user.role };
}

// GET /api/diary?student=id&date=2026-09-10&subject=Math
router.get("/", async (req: AuthedRequest, res) => {
  const { student, date, subject } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (student) {
    if (!isValidObjectId(student)) return res.status(400).json({ error: "Invalid student id" });
    if (!(await findAccessibleStudent(req.user!, student))) return res.status(404).json({ error: "Student not found" });
    filter.student = student;
  } else {
    filter.student = { $in: await accessibleStudentIds(req.user!) };
  }
  if (date) filter.date = date;
  if (subject) filter.subject = { $regex: escapeRegex(subject), $options: "i" };
  const entries = await DiaryEntry.find(filter).sort({ date: -1, createdAt: -1 }).populate("student", "fullName");
  res.json(entries);
});

router.post("/", validateBody(createSchema), async (req: AuthedRequest, res) => {
  const user = req.user!;
  let studentId: string | undefined = req.body.student;

  if (user.role === "student") {
    const own = await Student.findOne({ user: user.id }).select("_id");
    if (!own) return res.status(404).json({ error: "Student profile not found" });
    studentId = own.id;
  } else {
    if (!studentId) return res.status(400).json({ error: "Choose a student" });
    if (!(await findAccessibleStudent(user, studentId))) return res.status(404).json({ error: "Student not found" });
  }

  const entry = await DiaryEntry.create({ ...req.body, student: studentId, author: await actorFor(user) });
  res.status(201).json(entry);
});

router.patch("/:id", validateBody(updateSchema), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const user = req.user!;
  const entry = await DiaryEntry.findById(req.params.id);
  if (!entry || !(await findAccessibleStudent(user, entry.student.toString()))) {
    return res.status(404).json({ error: "Diary entry not found" });
  }

  const changed = DIARY_CONTENT_FIELDS.filter(
    (f) => req.body[f] !== undefined && (req.body[f] ?? "") !== ((entry as any)[f] ?? "")
  );

  if (changed.length > 0) {
    // Students may tick homework on any entry, but only rewrite their own.
    if (user.role === "student" && entry.author?.user?.toString() !== user.id) {
      return res.status(403).json({ error: "You can only edit diary entries you wrote" });
    }
    const previous: Record<string, unknown> = {};
    for (const f of DIARY_CONTENT_FIELDS) previous[f] = (entry as any)[f];
    entry.history.push({ ...previous, editedAt: new Date(), editedBy: await actorFor(user) } as any);
    for (const f of changed) (entry as any)[f] = req.body[f];
  }
  if (req.body.homeworkStatus) entry.homeworkStatus = req.body.homeworkStatus;

  await entry.save();
  res.json(entry);
});

// Students can't delete, so an edited entry's history can't be made to vanish.
router.delete("/:id", requireRole("admin", "teacher"), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const entry = await DiaryEntry.findById(req.params.id);
  if (!entry || !(await findAccessibleStudent(req.user!, entry.student.toString()))) {
    return res.status(404).json({ error: "Diary entry not found" });
  }
  await DiaryEntry.deleteOne({ _id: entry._id });
  res.json({ ok: true });
});

export default router;
