import { Schema, model, Document } from "mongoose";

export type Role = "admin" | "teacher" | "student";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  // Teachers only: the code a student enters at signup to join this teacher.
  teacherKey?: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "teacher", "student"], required: true, index: true },
  teacherKey: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

export default model<IUser>("User", userSchema);
