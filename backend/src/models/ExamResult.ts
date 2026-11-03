import { Schema, model, Document, Types } from "mongoose";

export interface IExamResult extends Document {
  student: Types.ObjectId;
  examName: string;
  subject: string;
  examDate: string; // YYYY-MM-DD
  totalMarks: number;
  obtainedMarks: number;
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examResultSchema = new Schema<IExamResult>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    examName: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    examDate: { type: String, required: true },
    totalMarks: { type: Number, required: true, min: 0 },
    obtainedMarks: { type: Number, required: true, min: 0 },
    comments: { type: String },
  },
  { timestamps: true }
);

export default model<IExamResult>("ExamResult", examResultSchema);
