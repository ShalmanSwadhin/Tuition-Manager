import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useServerWaking } from "../api/useServerWaking";
import type { Role } from "../types";

// Without `roles`, any signed-in user may enter; with it, other roles are
// sent home. The API enforces the same rules -- this just avoids dead pages.
export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, status, retrySession } = useAuth();
  const waking = useServerWaking();

  if (status === "checking") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center text-slate-500" role="status">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden />
        <p className="text-sm">{waking ? "Starting up, this can take up to a minute…" : "Loading…"}</p>
      </div>
    );
  }

  // We couldn't find out whether the user is signed in. Don't send them to
  // the login page -- their session may be perfectly valid.
  if (status === "unavailable" || status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <p className="max-w-xs text-sm text-slate-600">
          {status === "unavailable"
            ? "We couldn't reach the server. It may still be starting up — please try again."
            : "Something went wrong while loading your account. Please try again."}
        </p>
        <button onClick={retrySession} className="btn-primary px-6">
          Retry
        </button>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
