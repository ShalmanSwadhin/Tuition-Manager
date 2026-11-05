import { Router } from "express";
import { z } from "zod";
import Notice from "../models/Notice";
import Student from "../models/Student";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";

const router = Router();
router.use(requireAuth);

const noticeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().max(5000).optional(),
});

// Teachers see their own notices, students their teacher's, admin all.
router.get("/", async (req: AuthedRequest, res) => {
  const user = req.user!;
  const filter: Record<string, unknown> = {};
  if (user.role === "teacher") filter.teacher = user.id;
  if (user.role === "student") {
    const profile = await Student.findOne({ user: user.id }).select("teacher");
    if (!profile) return res.json([]);
    filter.teacher = profile.teacher;
  }
  const notices = await Notice.find(filter).sort({ createdAt: -1 }).limit(100).populate("teacher", "name");
  res.json(notices);
});

router.post("/", requireRole("teacher"), validateBody(noticeSchema), async (req: AuthedRequest, res) => {
  const notice = await Notice.create({ ...req.body, teacher: req.user!.id });
  res.status(201).json(notice);
});

router.patch("/:id", requireRole("teacher"), validateBody(noticeSchema.partial()), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const notice = await Notice.findOneAndUpdate({ _id: req.params.id, teacher: req.user!.id }, req.body, { new: true });
  if (!notice) return res.status(404).json({ error: "Notice not found" });
  res.json(notice);
});

router.delete("/:id", requireRole("admin", "teacher"), async (req: AuthedRequest, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const scope = req.user!.role === "admin" ? {} : { teacher: req.user!.id };
  const notice = await Notice.findOneAndDelete({ _id: req.params.id, ...scope });
  if (!notice) return res.status(404).json({ error: "Notice not found" });
  res.json({ ok: true });
});

export default router;
