import { NavLink, Outlet } from "react-router-dom";
import {
  Home,
  Users,
  GraduationCap,
  BookOpen,
  FileBarChart,
  CalendarDays,
  UserCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  desktopOnly?: boolean; // keeps the phone tab bar to at most five tabs
}

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/teachers", label: "Teachers", icon: GraduationCap },
    { to: "/students", label: "Students", icon: Users },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, desktopOnly: true },
    { to: "/reports", label: "Reports", icon: FileBarChart },
    { to: "/account", label: "Account", icon: UserCircle },
  ],
  teacher: [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/students", label: "Students", icon: Users },
    { to: "/diary", label: "Diary", icon: BookOpen },
    { to: "/calendar", label: "Calendar", icon: CalendarDays, desktopOnly: true },
    { to: "/reports", label: "Reports", icon: FileBarChart },
    { to: "/account", label: "Account", icon: UserCircle },
  ],
  student: [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/diary", label: "My diary", icon: BookOpen },
    { to: "/account", label: "Account", icon: UserCircle },
  ],
};

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", teacher: "Teacher", student: "Student" };

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV[user.role];
  const mobileItems = items.filter((i) => !i.desktopOnly);

  return (
    <div className="flex min-h-full bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">
          <p className="text-lg font-bold text-slate-900">Tuition Manager</p>
          <p className="truncate text-xs text-slate-500">
            {user.name} · {ROLE_LABEL[user.role]}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button onClick={logout} className="btn-ghost w-full justify-start">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur md:hidden">
          <p className="text-base font-bold text-slate-900">Tuition Manager</p>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            {ROLE_LABEL[user.role]}
          </span>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </main>

        {/* Phone bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="flex">
            {mobileItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                    isActive ? "text-brand-600" : "text-slate-500"
                  }`
                }
              >
                <Icon size={22} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
