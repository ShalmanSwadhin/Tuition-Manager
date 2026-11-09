import { useEffect, useRef, useState, FormEvent } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { isBackendUnavailable } from "../api/client";
import { useServerWaking } from "../api/useServerWaking";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col justify-center bg-slate-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">T</div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export const STARTING_UP_MESSAGE = "Starting up the server, this can take up to a minute…";
export const STILL_STARTING_MESSAGE = "The server is taking longer than usual to start. Please try again in a moment.";

// Cancels an in-flight request (and its cold-start waiting) when the page
// unmounts, and lets a handler ignore a second submit while one is running.
export function useSubmission() {
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return {
    begin(): AbortSignal | null {
      if (inFlight.current) return null;
      inFlight.current = true;
      controller.current = new AbortController();
      return controller.current.signal;
    },
    end() {
      inFlight.current = false;
    },
  };
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const waking = useServerWaking();
  const submission = useSubmission();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const signal = submission.begin();
    if (!signal) return; // already signing in
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, signal);
      navigate("/");
    } catch (err: any) {
      if (axios.isCancel(err)) return;
      setError(
        isBackendUnavailable(err) ? STILL_STARTING_MESSAGE : err?.response?.data?.error || "Login failed. Please try again."
      );
    } finally {
      submission.end();
      if (!signal.aborted) setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to Tuition Manager">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {submitting && waking && (
          <p className="text-sm text-slate-500" role="status">
            {STARTING_UP_MESSAGE}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-brand-600">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
