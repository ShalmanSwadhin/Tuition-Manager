import { useEffect, useState } from "react";
import { Upload, Download, Trash2, FileText, FileImage, FileSpreadsheet, Presentation, FileArchive, File as FileIcon } from "lucide-react";
import api from "../api/client";
import Sheet from "./Sheet";
import { formatDate } from "../utils/date";
import type { StudentFile } from "../types";

const MAX_MB = 20;
const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(f: StudentFile) {
  const name = f.filename.toLowerCase();
  if (f.contentType.startsWith("image/")) return FileImage;
  if (/\.(pptx?|key|odp)$/.test(name)) return Presentation;
  if (/\.(xlsx?|csv|ods)$/.test(name)) return FileSpreadsheet;
  if (/\.(zip|rar|7z)$/.test(name)) return FileArchive;
  if (/\.(pdf|docx?|txt|odt|rtf)$/.test(name)) return FileText;
  return FileIcon;
}

const fileUrl = (id: string, download = false) => `${api.defaults.baseURL}/files/${id}/download${download ? "?download=1" : ""}`;

function UploadSheet({ studentId, onClose, onUploaded }: { studentId: string; onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a file first.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is ${formatBytes(file.size)}. The limit is ${MAX_MB} MB.`);
    setError(null);
    setProgress(0);
    const form = new FormData();
    form.append("student", studentId);
    if (note.trim()) form.append("note", note.trim());
    form.append("file", file);
    try {
      await api.post("/files", form, {
        onUploadProgress: (p) => setProgress(p.total ? Math.round((p.loaded / p.total) * 100) : 0),
      });
      onUploaded();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Upload failed. Check your connection and try again.");
      setProgress(null);
    }
  }

  return (
    <Sheet title="Share a file" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-6 text-center active:bg-slate-50">
          <Upload className="text-brand-600" />
          <span className="text-sm font-semibold text-slate-800">{file ? file.name : "Choose a file"}</span>
          <span className="text-xs text-slate-500">
            {file ? formatBytes(file.size) : `Photos, PDF, Word, PowerPoint, anything — up to ${MAX_MB} MB`}
          </span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div>
          <label className="label">
            Note <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Read before Sunday's class" className="input" />
        </div>
        {progress !== null && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={progress !== null} className="btn-primary w-full py-3">
          {progress !== null ? `Uploading… ${progress}%` : "Upload"}
        </button>
        <p className="text-center text-xs text-slate-400">Only this student (and you) can see it.</p>
      </form>
    </Sheet>
  );
}

export default function StudentFiles({ studentId, canManage }: { studentId: string; canManage: boolean }) {
  const [files, setFiles] = useState<StudentFile[] | null>(null);
  const [uploading, setUploading] = useState(false);

  function load() {
    api.get<StudentFile[]>("/files", { params: { student: studentId } }).then((res) => setFiles(res.data));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [studentId]);

  async function remove(f: StudentFile) {
    if (!confirm(`Delete "${f.filename}"? The student won't be able to open it any more.`)) return;
    await api.delete(`/files/${f._id}`);
    load();
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Study materials</h2>
        {canManage && (
          <button onClick={() => setUploading(true)} className="btn-secondary px-3 py-2">
            <Upload size={16} /> Upload
          </button>
        )}
      </div>

      {files === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : files.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">
          {canManage ? "No files yet. Upload notes, slides or photos for this student." : "Your teacher hasn't shared any files yet."}
        </p>
      ) : (
        <ul className="card divide-y divide-slate-100 p-0">
          {files.map((f) => {
            const Icon = iconFor(f);
            const isImage = f.contentType.startsWith("image/") && PREVIEWABLE.has(f.contentType);
            return (
              <li key={f._id} className="flex items-center gap-3 px-3 py-3">
                <a
                  href={fileUrl(f._id, !PREVIEWABLE.has(f.contentType))}
                  target={PREVIEWABLE.has(f.contentType) ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {isImage ? (
                    <img src={fileUrl(f._id)} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon size={22} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{f.filename}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {formatBytes(f.size)} · {formatDate(f.createdAt.slice(0, 10))}
                    </span>
                    {f.note && <span className="block truncate text-xs text-slate-600">{f.note}</span>}
                  </span>
                </a>
                {PREVIEWABLE.has(f.contentType) && (
                  <a href={fileUrl(f._id, true)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Download">
                    <Download size={18} />
                  </a>
                )}
                {canManage && (
                  <button onClick={() => remove(f)} className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {uploading && (
        <UploadSheet
          studentId={studentId}
          onClose={() => setUploading(false)}
          onUploaded={() => {
            setUploading(false);
            load();
          }}
        />
      )}
    </section>
  );
}
