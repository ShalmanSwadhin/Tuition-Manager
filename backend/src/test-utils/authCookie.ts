import jwt from "jsonwebtoken";

// Route-level tests set JWT_SECRET themselves (see each spec's top), so this
// just signs against whatever is currently in process.env.
export function authCookieFor(adminId: string): string {
  const token = jwt.sign({ sub: adminId }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
  return `token=${token}`;
}
