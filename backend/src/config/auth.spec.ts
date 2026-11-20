import {
  sessionDays,
  sessionSeconds,
  sessionCookieOptions,
  clearSessionCookieOptions,
  checkAuthConfig,
  DEFAULT_SESSION_DAYS,
} from "./auth";

const STRONG_SECRET = "x".repeat(48);

describe("session length (SESSION_DAYS)", () => {
  it("defaults to 90 days", () => {
    expect(DEFAULT_SESSION_DAYS).toBe(90);
    expect(sessionDays({})).toBe(90);
    expect(sessionSeconds({})).toBe(90 * 24 * 60 * 60);
  });

  it("accepts a whole number of days", () => {
    expect(sessionDays({ SESSION_DAYS: "30" })).toBe(30);
    expect(sessionDays({ SESSION_DAYS: " 90 " })).toBe(90);
  });

  it.each(["abc", "-5", "0", "1.5", "999", "7d", "90 days"])(
    "falls back to 90 for an invalid value (%s) instead of producing instantly-expiring logins",
    (value) => {
      expect(sessionDays({ SESSION_DAYS: value })).toBe(90);
    }
  );
});

describe("session cookie", () => {
  it("in production: httpOnly, Secure, SameSite=Lax, whole site, and as long as the token", () => {
    expect(sessionCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });
  });

  it("in development: not Secure (plain http://localhost), otherwise the same", () => {
    expect(sessionCookieOptions({ NODE_ENV: "development" })).toMatchObject({ secure: false, sameSite: "lax", httpOnly: true });
  });

  it("follows SESSION_DAYS, so cookie and token always expire together", () => {
    expect(sessionCookieOptions({ SESSION_DAYS: "30" }).maxAge).toBe(sessionSeconds({ SESSION_DAYS: "30" }) * 1000);
  });

  it("is cleared with the same attributes it was set with (otherwise the browser keeps it)", () => {
    const { maxAge, ...rest } = sessionCookieOptions({ NODE_ENV: "production" });
    expect(clearSessionCookieOptions({ NODE_ENV: "production" })).toEqual(rest);
    expect(maxAge).toBeGreaterThan(0);
  });
});

describe("startup checks", () => {
  it("passes a complete configuration", () => {
    expect(checkAuthConfig({ JWT_SECRET: STRONG_SECRET, SESSION_DAYS: "90" })).toEqual({ errors: [], warnings: [] });
  });

  it("refuses to start without JWT_SECRET (no insecure fallback)", () => {
    expect(checkAuthConfig({}).errors).toEqual(["JWT_SECRET is not set."]);
  });

  it("warns about a short JWT_SECRET without revealing it", () => {
    const { errors, warnings } = checkAuthConfig({ JWT_SECRET: "short-secret-123" });
    expect(errors).toEqual([]);
    expect(warnings.join(" ")).toMatch(/shorter than 32/);
    expect(warnings.join(" ")).not.toContain("short-secret-123");
  });

  it("flags the old JWT_EXPIRES_IN setting as ignored", () => {
    const { warnings } = checkAuthConfig({ JWT_SECRET: STRONG_SECRET, JWT_EXPIRES_IN: "7d" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/JWT_EXPIRES_IN is no longer used.*90 days/);
  });

  it("flags an invalid SESSION_DAYS", () => {
    const { warnings } = checkAuthConfig({ JWT_SECRET: STRONG_SECRET, SESSION_DAYS: "7d" });
    expect(warnings[0]).toMatch(/SESSION_DAYS must be a whole number/);
  });
});
