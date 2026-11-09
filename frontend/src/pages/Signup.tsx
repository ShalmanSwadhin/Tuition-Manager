import { useState, FormEvent } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { GraduationCap, BookOpenCheck } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { classifyFailure } from "../api/client";
import { useServerWaking } from "../api/useServerWaking";
import { AuthShell, useSubmission, STARTING_UP_MESSAGE, STILL_STARTING_MESSAGE } from "./Login";

type SignupRole = "teacher" | "student";

export default function Signup() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teacherKey, setTeacherKey] = useState("");
  const [classGrade, setClassGrade] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const waking = useServerWaking();
  const submission = useSubmission();

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    const signal = submission.begin();
    if (!signal) return; // already submitting
    setError(null);
    setSubmitting(true);
    try {
      if (role === "teacher") {
        await register({ role, name, email, password }, signal);
      } else {
        await register({ role, name, email, password, teacherKey: teacherKey.trim(), classGrade }, signal);
      }
      navigate("/");
    } catch (err: any) {
      if (axios.isCancel(err)) return;
      const failure = classifyFailure(err);
      if (failure === "ambiguous") {
        // The request may have reached the server before the connection
        // dropped, so it wasn't resent automatically.
        setError(
          "We couldn't confirm your sign-up because the connection dropped. Try signing in first; if that doesn't work, sign up again."
        );
      } else if (failure === "unreached") {
        setError(STILL_STARTING_MESSAGE);
      } else {
        const data = err?.response?.data;
        const fieldError = data?.details?.fieldErrors && Object.values(data.details.fieldErrors).flat()[0];
        setError((fieldError as string) || data?.error || "Sign up failed. Please try again.");
      }
    } finally {
      submission.end();
      if (!signal.aborted) setSubmitting(false);
    }
  }

  const roleButton = (value: SignupRole, label: string, hint: string, Icon: typeof GraduationCap) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-center transition ${
        role === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
      }`}
    >
      <Icon size={28} />
      <span className="text-base font-semibold">{label}</span>
      <span className="text-xs text-slate-500">{hint}</span>
    </button>
  );

  return (
    <AuthShell title="Create account" subtitle="Are you a teacher or a student?">
      <div className="flex gap-3">
        {roleButton("teacher", "Teacher", "I teach students", GraduationCap)}
        {roleButton("student", "Student", "I have a teacher key", BookOpenCheck)}
      </div>

      {role && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
          </div>

          {role === "student" && (
            <>
              <div>
                <label className="label">Teacher key</label>
                <input
                  required
                  value={teacherKey}
                  onChange={(e) => setTeacherKey(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. K7M3QX"
                  className="input font-mono tracking-widest"
                />
                <p className="mt-1 text-xs text-slate-400">Ask your teacher for their key. It links you to them.</p>
              </div>
              <div>
                <label className="label">Class</label>
                <input required value={classGrade} onChange={(e) => setClassGrade(e.target.value)} placeholder="e.g. Class 8" className="input" />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {submitting && waking && (
            <p className="text-sm text-slate-500" role="status">
              {STARTING_UP_MESSAGE}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? "Creating account…" : `Sign up as ${role === "teacher" ? "Teacher" : "Student"}`}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
