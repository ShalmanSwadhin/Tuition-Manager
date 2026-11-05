import { useState } from "react";
import { Copy, Check, Share2, RefreshCw, KeyRound } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function TeacherKeyCard({ allowRegenerate = false }: { allowRegenerate?: boolean }) {
  const { user, updateUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = user?.teacherKey;
  if (!key) return null;

  const shareText = `Join my class on Tuition Manager: sign up as a Student at ${window.location.origin}/signup and enter my teacher key: ${key}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(key!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Copy your teacher key:", key);
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        /* user closed the share sheet */
      }
    } else {
      await navigator.clipboard.writeText(shareText).catch(() => {});
      alert("Invite message copied — paste it to your student.");
    }
  }

  async function regenerate() {
    if (!confirm("Make a new key? The old key stops working for new sign-ups. Students who already joined stay with you.")) return;
    setBusy(true);
    try {
      const res = await api.post<{ teacherKey: string }>("/auth/teacher-key");
      updateUser({ teacherKey: res.data.teacherKey });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-4 text-white shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-brand-100">
        <KeyRound size={14} /> Your teacher key
      </p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em]">{key}</p>
      <p className="mt-1 text-xs text-brand-100">Students enter this key when they sign up to join your class.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={copy} className="btn bg-white/15 px-3 py-2 text-white hover:bg-white/25">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
        </button>
        <button onClick={share} className="btn bg-white px-3 py-2 text-brand-700 hover:bg-brand-50">
          <Share2 size={16} /> Share invite
        </button>
        {allowRegenerate && (
          <button onClick={regenerate} disabled={busy} className="btn bg-white/15 px-3 py-2 text-white hover:bg-white/25">
            <RefreshCw size={16} /> New key
          </button>
        )}
      </div>
    </div>
  );
}
