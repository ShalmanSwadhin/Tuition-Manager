import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
import api, { isBackendUnavailable } from "../api/client";
import type { AuthUser } from "../types";

export type RegisterPayload =
  | { role: "teacher"; name: string; email: string; password: string }
  | { role: "student"; name: string; email: string; password: string; teacherKey: string; classGrade: string };

// Where the startup session check stands:
// - checking: waiting for /auth/me (including while the backend wakes up)
// - ready: we know the answer -- `user` is set, or null for "not signed in"
// - unavailable: the server couldn't be reached, so we don't know yet
// - error: the server answered with an unexpected error, so we don't know yet
export type SessionStatus = "checking" | "ready" | "unavailable" | "error";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  status: SessionStatus;
  retrySession: () => void;
  login: (email: string, password: string, signal?: AbortSignal) => Promise<void>;
  register: (payload: RegisterPayload, signal?: AbortSignal) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("checking");

  const checkSession = useCallback((signal?: AbortSignal) => {
    setStatus("checking");
    api
      .get<AuthUser>("/auth/me", { signal })
      .then((res) => {
        setUser(res.data);
        setStatus("ready");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        // Only the server saying "not authenticated" means signed out. Anything
        // else (asleep, unreachable, crashed) leaves a possibly valid session alone.
        if (err?.response?.status === 401) {
          setUser(null);
          setStatus("ready");
        } else {
          setStatus(isBackendUnavailable(err) ? "unavailable" : "error");
        }
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkSession(controller.signal);
    return () => controller.abort();
  }, [checkSession]);

  async function login(email: string, password: string, signal?: AbortSignal) {
    // Logging in again has no lasting side effect (it just issues a new
    // session cookie), so a couple of resends after a lost reply are fine.
    // Kept small because every attempt that does reach the server counts
    // toward its 10-attempts-per-15-minutes login limit.
    const res = await api.post<AuthUser>("/auth/login", { email, password }, { signal, ambiguousRetries: 2 });
    setUser(res.data);
    setStatus("ready");
  }

  async function register(payload: RegisterPayload, signal?: AbortSignal) {
    // No `ambiguousRetries`: a sign-up is only resent when the request
    // provably never reached the server, so it can't create an account twice.
    const res = await api.post<AuthUser>("/auth/register", payload, { signal });
    setUser(res.data);
    setStatus("ready");
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
    setStatus("ready");
  }

  function updateUser(patch: Partial<AuthUser>) {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: status === "checking",
        status,
        retrySession: () => checkSession(),
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
