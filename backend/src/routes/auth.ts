import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import Admin from "../models/Admin";
import { validateBody } from "../middleware/validate";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(adminId: string): string {
  return jwt.sign({ sub: adminId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any,
  });
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(admin.id);
  res.cookie("token", token, cookieOpts);
  res.json({ id: admin.id, name: admin.name, email: admin.email });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token", { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const admin = await Admin.findById(req.adminId).select("name email");
  if (!admin) return res.status(401).json({ error: "Not authenticated" });
  res.json({ id: admin.id, name: admin.name, email: admin.email });
});

export default router;
