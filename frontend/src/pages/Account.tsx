import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import TeacherKeyCard from "../components/TeacherKeyCard";

const ROLE_LABEL = { admin: "Admin", teacher: "Teacher", student: "Student" } as const;

export default function Account() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Account</h1>
      <div className="card">
        <p className="text-lg font-semibold text-slate-900">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
        <span className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          {ROLE_LABEL[user.role]}
        </span>
        {user.role === "student" && (
          <p className="mt-3 text-sm text-slate-600">
            Your teacher: <span className="font-semibold text-slate-900">{user.teacherName || "—"}</span>
          </p>
        )}
      </div>

      {user.role === "teacher" && <TeacherKeyCard allowRegenerate />}

      <button onClick={logout} className="btn-secondary w-full py-3 text-red-600">
        <LogOut size={18} /> Log out
      </button>
    </div>
  );
}
