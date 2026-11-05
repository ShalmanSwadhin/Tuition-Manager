import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Teachers from "./pages/Teachers";
import GlobalCalendar from "./pages/GlobalCalendar";
import Diary from "./pages/Diary";
import Reports from "./pages/Reports";
import Account from "./pages/Account";
import Notices from "./pages/Notices";

// Students land on their own page; teachers and admin on the dashboard.
function Home() {
  const { user } = useAuth();
  if (user?.role === "student") {
    return user.studentId ? <StudentProfile selfId={user.studentId} /> : <p className="text-sm text-slate-500">Your profile is missing. Contact your teacher.</p>;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/account" element={<Account />} />
          <Route path="/notices" element={<Notices />} />
          <Route element={<ProtectedRoute roles={["admin", "teacher"]} />}>
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentProfile />} />
            <Route path="/calendar" element={<GlobalCalendar />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/teachers" element={<Teachers />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
