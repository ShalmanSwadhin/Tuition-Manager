import { Router } from "express";
import User from "../models/User";
import Student from "../models/Student";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// Every teacher with their key and how many students have joined them.
router.get("/teachers", async (_req, res) => {
  const teachers = await User.find({ role: "teacher" }).select("name email teacherKey createdAt").sort({ name: 1 });
  const counts = await Student.aggregate<{ _id: unknown; count: number }>([
    { $match: { status: { $ne: "archived" } } },
    { $group: { _id: "$teacher", count: { $sum: 1 } } },
  ]);
  const countByTeacher = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json(
    teachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      teacherKey: t.teacherKey,
      createdAt: t.createdAt,
      studentCount: countByTeacher.get(t.id) || 0,
    }))
  );
});

export default router;
