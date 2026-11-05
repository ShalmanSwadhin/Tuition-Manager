// File bytes are kept in MongoDB GridFS, so uploads need no extra storage
// service and survive Render restarts (its disk is wiped on every deploy).
// Everything counts toward the database's size limit (512 MB on Atlas M0).
import mongoose, { Types } from "mongoose";
import type { Readable } from "stream";

const BUCKET = "studentFiles";

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export function saveFile(buffer: Buffer, filename: string, contentType: string): Promise<Types.ObjectId> {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { metadata: { contentType } });
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id as Types.ObjectId));
    upload.end(buffer);
  });
}

export function openFile(gridId: Types.ObjectId): Readable {
  return bucket().openDownloadStream(gridId);
}

export async function deleteFile(gridId: Types.ObjectId): Promise<void> {
  try {
    await bucket().delete(gridId);
  } catch (err: any) {
    // Already gone -- the metadata is what matters to the app.
    if (!/FileNotFound|not found/i.test(String(err?.message))) throw err;
  }
}
