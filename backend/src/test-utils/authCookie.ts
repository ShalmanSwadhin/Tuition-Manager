import jwt from "jsonwebtoken";
import type { Role } from "../models/User";

// Route-level tests set JWT_SECRET themselves (see each spec's top), so this
// just signs against whatever is currently in process.env.
export function authCookieFor(userId: string, role: Role = "admin"): string {
  const token = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
  return `token=${token}`;
}
