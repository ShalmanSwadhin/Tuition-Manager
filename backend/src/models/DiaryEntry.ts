import { Schema, model, Document, Types } from "mongoose";

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

export default model<IDiaryEntry>("DiaryEntry", diaryEntrySchema);
