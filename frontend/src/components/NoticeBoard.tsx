import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Sheet from "./Sheet";
import { formatDateTime } from "../utils/date";
import type { Notice } from "../types";

const SEEN_KEY = "notices-seen-at";

function readSeenAt(): string {
  try {
    return localStorage.getItem(SEEN_KEY) || "";
  } catch {
    return "";
  }
}

function NoticeForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/notices", { title, body: body || undefined });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't post the notice");
      setSaving(false);
    }
  }

  return (
    <Sheet title="New notice" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. No class on Friday" className="input" />
        </div>
        <div>
          <label className="label">
            Details <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full py-3">
          {saving ? "Posting…" : "Post to all my students"}
        </button>
      </form>
    </Sheet>
  );
}

// `limit` shows a short preview with a "See all" link (home screens);
// without it, the full list (the Notices page).
export default function NoticeBoard({ limit, hideWhenEmpty = false }: { limit?: number; hideWhenEmpty?: boolean }) {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [posting, setPosting] = useState(false);
  const [seenAt] = useState(readSeenAt);

  function load() {
    api.get<Notice[]>("/notices").then((res) => setNotices(res.data));
  }
  useEffect(load, []);

  // Opening the full list counts as having read everything.
  useEffect(() => {
    if (!limit && notices?.length) {
      try {
        localStorage.setItem(SEEN_KEY, notices[0].createdAt);
      } catch {
        /* private mode: "new" badges just stay */
      }
    }
  }, [limit, notices]);

  if (!user) return null;
  const isTeacher = user.role === "teacher";
  const canDelete = user.role !== "student";

  async function remove(n: Notice) {
    if (!confirm(`Delete the notice "${n.title}"?`)) return;
    await api.delete(`/notices/${n._id}`);
    load();
  }

  if (hideWhenEmpty && notices?.length === 0 && !isTeacher) return null;
  const shown = limit ? notices?.slice(0, limit) : notices;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Megaphone size={18} className="text-amber-500" /> Notices
        </h2>
        <div className="flex items-center gap-3">
          {limit && notices && notices.length > limit && (
            <Link to="/notices" className="text-sm font-medium text-brand-600">
              See all
            </Link>
          )}
          {isTeacher && (
            <button onClick={() => setPosting(true)} className="btn-secondary px-3 py-2">
              <Plus size={16} /> Post
            </button>
          )}
        </div>
      </div>

      {notices === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : notices.length === 0 ? (
        <p className="card text-center text-sm text-slate-500">
          {isTeacher ? "Post a notice and all your students will see it." : "No notices yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown!.map((n) => {
            const isNew = user.role === "student" && n.createdAt > seenAt;
            const teacherName = typeof n.teacher === "object" ? n.teacher.name : "";
            return (
              <li key={n._id} className={`card ${isNew ? "border-amber-300 bg-amber-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {isNew && <span className="mr-2 rounded-full bg-amber-500 px-2 py-0.5 align-middle text-[10px] font-bold text-white">NEW</span>}
                    {n.title}
                  </p>
                  {canDelete && (
                    <button onClick={() => remove(n)} className="-mr-2 -mt-1 rounded-full p-2 text-slate-400 hover:text-red-600" aria-label="Delete notice">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>}
                <p className="mt-2 text-xs text-slate-400">
                  {formatDateTime(n.createdAt)}
                  {user.role !== "teacher" && teacherName ? ` · ${teacherName}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {posting && (
        <NoticeForm
          onClose={() => setPosting(false)}
          onSaved={() => {
            setPosting(false);
            load();
          }}
        />
      )}
    </section>
  );
}
