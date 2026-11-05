import { Schema, model, Document, Types } from "mongoose";
import type { Role } from "./User";

export interface DiaryActor {
  user: Types.ObjectId;
  name: string;
  role: Role;
}

export interface DiaryVersion {
  date: string;
  subject: string;
  topic?: string;
  taughtToday?: string;
  homework?: string;
  nextPrep?: string;
  notes?: string;
  editedAt: Date; // when this version was replaced
  editedBy: DiaryActor; // who replaced it
}

export interface IDiaryEntry extends Document {
  student: Types.ObjectId;
  date: string; // YYYY-MM-DD
  subject: string;
  topic?: string;
  taughtToday?: string;
  homework?: string;
  nextPrep?: string;
  notes?: string;
  homeworkStatus: "pending" | "completed";
  author?: DiaryActor;
  history: DiaryVersion[]; // previous versions, oldest first
  createdAt: Date;
  updatedAt: Date;
}

const actorSchema = new Schema<DiaryActor>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
  },
  { _id: false }
);

const versionSchema = new Schema<DiaryVersion>(
  {
    date: String,
    subject: String,
    topic: String,
    taughtToday: String,
    homework: String,
    nextPrep: String,
    notes: String,
    editedAt: { type: Date, required: true },
    editedBy: { type: actorSchema, required: true },
  },
  { _id: false }
);

const diaryEntrySchema = new Schema<IDiaryEntry>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    date: { type: String, required: true, index: true },
    subject: { type: String, required: true, trim: true },
    topic: { type: String, trim: true },
    taughtToday: { type: String },
    homework: { type: String },
    nextPrep: { type: String },
    notes: { type: String },
    homeworkStatus: { type: String, enum: ["pending", "completed"], default: "pending" },
    author: { type: actorSchema },
    history: { type: [versionSchema], default: [] },
  },
  { timestamps: true }
);

export default model<IDiaryEntry>("DiaryEntry", diaryEntrySchema);
