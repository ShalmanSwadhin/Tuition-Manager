import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "../api/client";
import type { AuthUser } from "../types";

export type RegisterPayload =
  | { role: "teacher"; name: string; email: string; password: string }
  | { role: "student"; name: string; email: string; password: string; teacherKey: string; classGrade: string };

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuthUser>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<AuthUser>("/auth/login", { email, password });
    setUser(res.data);
  }

  async function register(payload: RegisterPayload) {
    const res = await api.post<AuthUser>("/auth/register", payload);
    setUser(res.data);
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  function updateUser(patch: Partial<AuthUser>) {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
