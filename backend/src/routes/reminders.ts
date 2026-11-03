import { Router } from "express";
import { z } from "zod";
import Reminder from "../models/Reminder";
import { requireAuth } from "../middleware/auth";
import { validateBody, isValidObjectId } from "../middleware/validate";
import { isValidDateStr } from "../utils/dateUtils";

const router = Router();
router.use(requireAuth);

const reminderSchema = z.object({
  student: z.string().refine(isValidObjectId, "Invalid student id").optional(),
  title: z.string().min(1),
  dueDate: z.string().refine(isValidDateStr, "Invalid date"),
  notes: z.string().optional(),
  done: z.boolean().optional(),
});
const updateSchema = reminderSchema.partial();

router.get("/", async (req, res) => {
  const { done, upcoming } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (done !== undefined) filter.done = done === "true";
  if (upcoming === "true") filter.dueDate = { $gte: new Date().toISOString().slice(0, 10) };
  const reminders = await Reminder.find(filter).sort({ dueDate: 1 });
  res.json(reminders);
});

router.post("/", validateBody(reminderSchema), async (req, res) => {
  const reminder = await Reminder.create(req.body);
  res.status(201).json(reminder);
});

router.patch("/:id", validateBody(updateSchema), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });
  res.json(reminder);
});

router.delete("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const reminder = await Reminder.findByIdAndDelete(req.params.id);
  if (!reminder) return res.status(404).json({ error: "Reminder not found" });
  res.json({ ok: true });
});

export default router;
