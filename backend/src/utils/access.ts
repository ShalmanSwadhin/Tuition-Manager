// Who can see which students: admin sees everyone, a teacher sees only the
// students linked to them, a student sees only their own profile. Every
// route that touches student data filters through these helpers, so the
// rule lives in one place.
import type { FilterQuery, Types } from "mongoose";
import Student, { IStudent } from "../models/Student";
import type { AuthUser } from "../middleware/auth";
import { isValidObjectId } from "../middleware/validate";

export function studentScope(user: AuthUser): FilterQuery<IStudent> {
  if (user.role === "admin") return {};
  if (user.role === "teacher") return { teacher: user.id };
  return { user: user.id };
}

export async function findAccessibleStudent(user: AuthUser, id: string) {
  if (!isValidObjectId(id)) return null;
  return Student.findOne({ _id: id, ...studentScope(user) });
}

export async function accessibleStudentIds(user: AuthUser): Promise<Types.ObjectId[]> {
  const students = await Student.find(studentScope(user)).select("_id");
  return students.map((s) => s._id as Types.ObjectId);
}
