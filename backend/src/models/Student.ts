import { Schema, model, Document, Types } from "mongoose";

export type StudentStatus = "active" | "paused" | "archived";

export interface IStudent extends Document {
  fullName: string;
  photoUrl?: string;
  school?: string;
  classGrade: string;
  subjects: string[];
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  monthlyClassTarget: number;
  defaultClassDurationMinutes?: number;
  preferredDays?: string[]; // e.g. ["MON","WED","FRI"]
  classTime?: string; // "HH:MM" (24h, Dhaka time)
  notes?: string;
  joiningDate: string; // YYYY-MM-DD
  status: StudentStatus;
  color: string; // hex, assigned for global calendar
  attendanceVisible: boolean; // the teacher can hide the attendance calendar from the student
  teacher: Types.ObjectId; // the teacher (User) this student belongs to
  user?: Types.ObjectId; // the student's own login (User), if they signed up
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    fullName: { type: String, required: true, trim: true, index: true },
    photoUrl: { type: String },
    school: { type: String, trim: true },
    classGrade: { type: String, required: true, trim: true },
    subjects: { type: [String], default: [] },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    monthlyClassTarget: { type: Number, required: true, min: 1, default: 12 },
    defaultClassDurationMinutes: { type: Number },
    preferredDays: { type: [String], default: [] },
    classTime: { type: String, trim: true },
    notes: { type: String },
    joiningDate: { type: String, required: true },
    status: { type: String, enum: ["active", "paused", "archived"], default: "active", index: true },
    color: { type: String, default: "#6366f1" },
    attendanceVisible: { type: Boolean, default: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true, sparse: true },
  },
  { timestamps: true }
);

export default model<IStudent>("Student", studentSchema);
export type StudentId = Types.ObjectId;
