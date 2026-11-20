// Every authentication setting lives here, so the token, the cookie that
// carries it, and startup checks can never disagree with each other.
//
// Design: one signed JWT in an httpOnly cookie, valid for SESSION_DAYS.
// There are no refresh tokens: a login simply lasts SESSION_DAYS, after which
// the user signs in again.
import type { CookieOptions } from "express";

export const DEFAULT_SESSION_DAYS = 90;
export const MAX_SESSION_DAYS = 365;
export const JWT_ALGORITHM = "HS256" as const;
export const SESSION_COOKIE = "token";

type Env = Record<string, string | undefined>;

/** SESSION_DAYS as a whole number of days in 1..365; anything else falls back to 90. */
export function sessionDays(env: Env = process.env): number {
  const raw = env.SESSION_DAYS?.trim();
  if (!raw) return DEFAULT_SESSION_DAYS;
  const days = Number(raw);
  return Number.isInteger(days) && days >= 1 && days <= MAX_SESSION_DAYS ? days : DEFAULT_SESSION_DAYS;
}

export function sessionSeconds(env: Env = process.env): number {
  return sessionDays(env) * 24 * 60 * 60;
}

// SameSite=Lax: the browser only ever talks to the API on the app's own
// address (Vercel's /api rewrite in production, Vite's proxy in dev), so the
// cookie never needs to travel on requests started by other websites. That
// blocks cross-site request forgery against the API.
export function sessionCookieOptions(env: Env = process.env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionSeconds(env) * 1000,
  };
}

/** Same attributes as when the cookie was set, so the browser actually removes it. */
export function clearSessionCookieOptions(env: Env = process.env): CookieOptions {
  const { maxAge: _ignored, ...rest } = sessionCookieOptions(env);
  return rest;
}

/**
 * Startup checks. `errors` stop the server (it can't run safely);
 * `warnings` are logged so a misconfiguration is visible in the Render logs.
 * Never includes secret values.
 */
export function checkAuthConfig(env: Env = process.env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const secret = env.JWT_SECRET;
  if (!secret) errors.push("JWT_SECRET is not set.");
  else if (secret.length < 32) warnings.push("JWT_SECRET is shorter than 32 characters; use a long random value.");

  const rawDays = env.SESSION_DAYS?.trim();
  if (rawDays && sessionDays(env) !== Number(rawDays)) {
    warnings.push(
      `SESSION_DAYS must be a whole number from 1 to ${MAX_SESSION_DAYS}; using ${DEFAULT_SESSION_DAYS} days instead.`
    );
  }

  if (env.JWT_EXPIRES_IN !== undefined) {
    warnings.push(
      `JWT_EXPIRES_IN is no longer used and is ignored. Logins last SESSION_DAYS (now ${sessionDays(env)} days). You can delete JWT_EXPIRES_IN.`
    );
  }

  return { errors, warnings };
}
