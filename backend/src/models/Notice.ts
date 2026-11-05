import { Schema, model, Document, Types } from "mongoose";

// A notice a teacher posts to all of their students.
export interface INotice extends Document {
  teacher: Types.ObjectId;
  title: string;
  body?: string;
  createdAt: Date;
  updatedAt: Date;
}

const noticeSchema = new Schema<INotice>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model<INotice>("Notice", noticeSchema);
