import { Schema, model, Document, Types } from "mongoose";

export type ClassStatus = "scheduled" | "completed" | "cancelled";

export interface IClassSession extends Document {
  student: Types.ObjectId;
  date: string; // YYYY-MM-DD, Dhaka calendar date
  status: ClassStatus;
  note?: string;
  durationMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const classSessionSchema = new Schema<IClassSession>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "completed" },
    note: { type: String },
    durationMinutes: { type: Number },
  },
  { timestamps: true }
);

// Rule: exactly one class record per student per date, regardless of status.
// A date moves between scheduled -> completed -> cancelled by updating this
// one record (see the /mark endpoint), rather than by inserting new rows.
classSessionSchema.index({ student: 1, date: 1 }, { unique: true });

export default model<IClassSession>("ClassSession", classSessionSchema);
