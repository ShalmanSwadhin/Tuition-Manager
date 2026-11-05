import { Link } from "react-router-dom";
import { LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import TeacherKeyCard from "../components/TeacherKeyCard";
import { NAV } from "../components/Layout";

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

      {/* Pages that don't fit in the phone tab bar */}
      {NAV[user.role].some((i) => i.desktopOnly) && (
        <ul className="card divide-y divide-slate-100 p-0 md:hidden">
          {NAV[user.role]
            .filter((i) => i.desktopOnly)
            .map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="flex items-center gap-3 px-4 py-3.5 font-medium text-slate-800 active:bg-slate-50">
                  <Icon size={20} className="text-slate-500" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={18} className="text-slate-300" />
                </Link>
              </li>
            ))}
        </ul>
      )}

      <button onClick={logout} className="btn-secondary w-full py-3 text-red-600">
        <LogOut size={18} /> Log out
      </button>
    </div>
  );
}
