import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, BookOpen, FileBarChart, Settings, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/students", label: "Students", icon: Users },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/diary", label: "Daily Diary", icon: BookOpen },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">
          <h1 className="text-lg font-semibold text-slate-900">Tuition Manager</h1>
          <p className="text-xs text-slate-400">{user?.name}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClass(isActive)}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <h1 className="text-base font-semibold">Tuition Manager</h1>
          <button onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </header>

        {mobileOpen && (
          <nav className="space-y-1 border-b border-slate-200 bg-white px-3 py-3 md:hidden">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => linkClass(isActive)}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
              <LogOut size={18} />
              Log out
            </button>
          </nav>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
