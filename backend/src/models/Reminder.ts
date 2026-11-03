import { Schema, model, Document, Types } from "mongoose";

export interface IReminder extends Document {
  student?: Types.ObjectId;
  title: string;
  dueDate: string; // YYYY-MM-DD
  notes?: string;
  done: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<IReminder>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student" },
    title: { type: String, required: true, trim: true },
    dueDate: { type: String, required: true, index: true },
    notes: { type: String },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<IReminder>("Reminder", reminderSchema);
