import { Schema, model, Document, Types } from "mongoose";

// Metadata for a file a teacher shared with one student. The bytes live in
// GridFS (bucket "studentFiles"), referenced by `gridId`.
export interface IStudentFile extends Document {
  student: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number; // bytes
  note?: string;
  gridId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const studentFileSchema = new Schema<IStudentFile>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    note: { type: String, trim: true },
    gridId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

export default model<IStudentFile>("StudentFile", studentFileSchema);
