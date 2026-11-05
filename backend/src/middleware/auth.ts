import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "../models/User";

export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const ROLES: Role[] = ["admin", "teacher", "student"];

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string; role?: Role };
    // Tokens issued before roles existed carry no role -- make them log in again.
    if (!payload.role || !ROLES.includes(payload.role)) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Use after requireAuth.
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have access to this" });
    }
    next();
  };
}
