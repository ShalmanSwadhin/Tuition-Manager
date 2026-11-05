import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import User, { IUser, Role } from "../models/User";
import Student from "../models/Student";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { generateUniqueTeacherKey } from "../utils/teacherKey";
import { todayDhakaStr } from "../utils/dateUtils";

const router = Router();

// Keyed by email rather than IP: in production every request reaches the API
// through Vercel's proxy, so many different users can share one IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email || "").toLowerCase(),
  message: { error: "Too many login attempts. Try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-ups right now. Try again later." },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("teacher"),
    name: z.string().trim().min(1),
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
  z.object({
    role: z.literal("student"),
    name: z.string().trim().min(1),
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    teacherKey: z.string().trim().min(1, "Teacher key is required"),
    classGrade: z.string().trim().min(1, "Class is required"),
  }),
]);

const STUDENT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any,
  });
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// What the frontend gets to know about the signed-in user.
async function sessionInfo(user: IUser) {
  const info: Record<string, unknown> = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  if (user.role === "teacher") info.teacherKey = user.teacherKey;
  if (user.role === "student") {
    const profile = await Student.findOne({ user: user._id }).populate("teacher", "name");
    if (profile) {
      info.studentId = profile.id;
      info.teacherName = (profile.teacher as any)?.name;
    }
  }
  return info;
}

router.post("/register", registerLimiter, validateBody(registerSchema), async (req, res) => {
  const body = req.body as z.infer<typeof registerSchema>;
  const email = body.email.toLowerCase();

  if (await User.exists({ email })) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  let teacher: IUser | null = null;
  if (body.role === "student") {
    teacher = await User.findOne({ role: "teacher", teacherKey: body.teacherKey.toUpperCase() });
    if (!teacher) return res.status(400).json({ error: "No teacher found with that key. Check it with your teacher." });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({
    name: body.name,
    email,
    passwordHash,
    role: body.role,
    teacherKey: body.role === "teacher" ? await generateUniqueTeacherKey() : undefined,
  });

  if (body.role === "student" && teacher) {
    try {
      await Student.create({
        fullName: body.name,
        classGrade: body.classGrade,
        joiningDate: todayDhakaStr(),
        color: STUDENT_COLORS[Math.floor(Math.random() * STUDENT_COLORS.length)],
        teacher: teacher._id,
        user: user._id,
      });
    } catch (err) {
      // Don't leave a login behind with no student profile attached.
      await User.deleteOne({ _id: user._id });
      throw err;
    }
  }

  res.cookie("token", signToken(user.id, user.role), cookieOpts);
  res.status(201).json(await sessionInfo(user));
});

router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  res.cookie("token", signToken(user.id, user.role), cookieOpts);
  res.json(await sessionInfo(user));
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token", { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json(await sessionInfo(user));
});

// Teachers can issue a new key (e.g. if the old one was shared too widely).
// Students who already joined stay linked; only new sign-ups need the new key.
router.post("/teacher-key", requireAuth, requireRole("teacher"), async (req: AuthedRequest, res) => {
  const teacherKey = await generateUniqueTeacherKey();
  const user = await User.findByIdAndUpdate(req.user!.id, { teacherKey }, { new: true });
  if (!user) return res.status(404).json({ error: "Account not found" });
  res.json({ teacherKey: user.teacherKey });
});

export default router;
