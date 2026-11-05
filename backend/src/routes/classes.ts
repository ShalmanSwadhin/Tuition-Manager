import { Router } from "express";
import { z } from "zod";
import ClassSession from "../models/ClassSession";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { monthBounds, isValidDateStr, todayDhakaStr } from "../utils/dateUtils";
import { findAccessibleStudent, accessibleStudentIds } from "../utils/access";

const router = Router();
router.use(requireAuth);

const toggleSchema = z.object({
  student: z.string().refine(isValidObjectId, "Invalid student id"),
  date: z.string().refine(isValidDateStr, "Invalid date"),
});

// GET /api/classes?student=id&month=9&year=2026  (both optional)
// GET /api/classes?from=2026-09-01&to=2026-09-30  (global calendar range)
router.get("/", async (req: AuthedRequest, res) => {
  const { student, month, year, from, to } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (student) {
    if (!isValidObjectId(student)) return res.status(400).json({ error: "Invalid student id" });
    if (!(await findAccessibleStudent(req.user!, student))) return res.status(404).json({ error: "Student not found" });
    filter.student = student;
  } else {
    filter.student = { $in: await accessibleStudentIds(req.user!) };
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

// Tapping a day on the calendar: marks the student present (a "completed"
// class) on that date, or -- if they were already marked present -- removes
// the mark. One record per student/date, enforced by the model's unique index.
router.post("/toggle", requireRole("admin", "teacher"), validateBody(toggleSchema), async (req: AuthedRequest, res) => {
  const { student: studentId, date } = req.body;
  if (date > todayDhakaStr()) {
    return res.status(400).json({ error: "You can't mark attendance for a future date" });
  }
  if (!(await findAccessibleStudent(req.user!, studentId))) {
    return res.status(404).json({ error: "Student not found" });
  }

  const existing = await ClassSession.findOne({ student: studentId, date });
  if (existing && existing.status === "completed") {
    await ClassSession.deleteOne({ _id: existing._id });
    return res.json({ present: false });
  }

  try {
    // Older records may be "scheduled"/"cancelled"; tapping turns them into present.
    const session = await ClassSession.findOneAndUpdate(
      { student: studentId, date },
      { student: studentId, date, status: "completed" },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(existing ? 200 : 201).json({ present: true, session });
  } catch (err: any) {
    // A double tap raced us to the insert -- the day is already present.
    if (err?.code === 11000) return res.json({ present: true });
    throw err;
  }
});

export default router;
