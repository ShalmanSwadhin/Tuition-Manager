// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import Login, { STARTING_UP_MESSAGE, STILL_STARTING_MESSAGE } from "../pages/Login";
import Signup from "../pages/Signup";
import { recoveryTiming, isRecovering } from "../api/client";
import { installFakeBackend, restoreBackend, RENDER_ASLEEP, ok, appError, type Reply, type Call } from "../test/fakeBackend";
import type { InternalAxiosRequestConfig } from "axios";

// Same logic as production, on a shorter clock so tests run in real time.
const production = { ...recoveryTiming };
beforeEach(() => Object.assign(recoveryTiming, { intervalMs: 20, windowMs: 300 }));
afterEach(async () => {
  cleanup();
  restoreBackend();
  Object.assign(recoveryTiming, production);
  await waitFor(() => expect(isRecovering()).toBe(false));
});

const USER = { id: "u1", name: "Rahim", email: "rahim@example.com", role: "teacher", teacherKey: "K7M3QX" };

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<p>Dashboard</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

// Backend asleep until `ms` from now, then `awake` decides each reply.
function asleepFor(ms: number, awake: (config: InternalAxiosRequestConfig) => Reply): Call[] {
  const start = Date.now();
  return installFakeBackend((config) => (Date.now() - start < ms ? RENDER_ASLEEP : awake(config)));
}

const count = (calls: Call[], url: string) => calls.filter((c) => c.url === url).length;

function fillLogin(container: HTMLElement, email: string, password: string) {
  fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: email } });
  fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: password } });
}

describe("session check on startup", () => {
  it("restores a signed-in user straight away (200)", async () => {
    installFakeBackend((c) => (c.url === "/auth/me" ? ok(USER) : ok()));
    renderApp();
    expect(await screen.findByText("Dashboard")).toBeTruthy();
  });

  it("9. a signed-in user is NOT logged out while Render wakes up (502)", async () => {
    const calls = asleepFor(120, (c) => (c.url === "/auth/me" ? ok(USER) : ok()));
    renderApp();

    expect(await screen.findByText("Starting up, this can take up to a minute…")).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull(); // not sent to login
    expect(await screen.findByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(count(calls, "/auth/me")).toBe(2);
  });

  it("10. a genuinely expired session (401) goes to the login page", async () => {
    installFakeBackend((c) => (c.url === "/auth/me" ? appError(401, "Invalid or expired session") : ok()));
    renderApp();
    expect(await screen.findByText("Welcome back")).toBeTruthy();
  });

  it("4. if the server never wakes, shows an error with Retry (no endless spinner), and Retry recovers", async () => {
    let awake = false;
    installFakeBackend((c) => (!awake ? RENDER_ASLEEP : c.url === "/auth/me" ? ok(USER) : ok()));
    renderApp();

    expect(await screen.findByText(/couldn't reach the server/i, {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();

    awake = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Dashboard")).toBeTruthy();
  });

  it("an unexpected server error (500) doesn't log the user out either", async () => {
    installFakeBackend(() => appError(500, "Internal server error"));
    renderApp();
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
  });
});

describe("login page", () => {
  it("8. invalid credentials still show the server's message", async () => {
    installFakeBackend((c) =>
      c.url === "/auth/me" ? appError(401, "Not authenticated") : appError(401, "Invalid email or password")
    );
    const { container } = renderApp("/login");
    await screen.findByText("Welcome back");
    fillLogin(container, "rahim@example.com", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
  });

  it.each([
    [403, "Forbidden"],
    [429, "Too many login attempts. Try again later."],
  ])("%i shows the server's message without retrying", async (status, message) => {
    const calls = installFakeBackend((c) => (c.url === "/auth/me" ? appError(401, "Not authenticated") : appError(status, message)));
    const { container } = renderApp("/login");
    await screen.findByText("Welcome back");
    fillLogin(container, "rahim@example.com", "pw");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(count(calls, "/auth/login")).toBe(1);
  });

  it("waits through a cold start, shows the startup message, ignores double taps, then signs in", async () => {
    let asleep = false;
    let start = 0;
    const calls = installFakeBackend((c) => {
      if (c.url === "/auth/me") return appError(401, "Not authenticated");
      if (asleep && Date.now() - start < 120) return RENDER_ASLEEP;
      return c.url === "/auth/login" ? ok(USER) : ok();
    });
    const { container } = renderApp("/login");
    await screen.findByText("Welcome back");

    asleep = true;
    start = Date.now();
    fillLogin(container, "rahim@example.com", "correct");
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form); // double tap

    expect(await screen.findByText(STARTING_UP_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/Login failed/)).toBeNull();
    expect((container.querySelector('input[type="email"]') as HTMLInputElement).value).toBe("rahim@example.com");
    expect((screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement).disabled).toBe(true);

    expect(await screen.findByText("Dashboard")).toBeTruthy();
    expect(count(calls, "/auth/login")).toBe(2); // the one that hit sleeping Render + one resend
  });

  it("after the recovery window, explains and lets the user try again with their input kept", async () => {
    let awake = false;
    const calls = installFakeBackend((c) => {
      if (c.url === "/auth/me") return appError(401, "Not authenticated");
      if (!awake) return RENDER_ASLEEP;
      return c.url === "/auth/login" ? ok(USER) : ok();
    });
    const { container } = renderApp("/login");
    await screen.findByText("Welcome back");
    fillLogin(container, "rahim@example.com", "correct");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(STILL_STARTING_MESSAGE, {}, { timeout: 2000 })).toBeTruthy();
    expect((container.querySelector('input[type="password"]') as HTMLInputElement).value).toBe("correct");

    awake = true;
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Dashboard")).toBeTruthy();
    expect(count(calls, "/auth/login")).toBe(2);
  });

  it("13. leaving the page while waiting stops all background retries", async () => {
    const calls = installFakeBackend((c) => (c.url === "/auth/me" ? appError(401, "Not authenticated") : RENDER_ASLEEP));
    const { container, unmount } = renderApp("/login");
    await screen.findByText("Welcome back");
    fillLogin(container, "rahim@example.com", "pw");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(isRecovering()).toBe(true));

    unmount();
    await waitFor(() => expect(isRecovering()).toBe(false));
    const after = calls.length;
    await new Promise((r) => setTimeout(r, 150));
    expect(calls.length).toBe(after);
  });
});

describe("signup page", () => {
  async function submitTeacherSignup(container: HTMLElement) {
    await screen.findByText("Create account");
    fireEvent.click(screen.getByText("Teacher"));
    const inputs = container.querySelectorAll("form input");
    fireEvent.change(inputs[0], { target: { value: "Ms Rahman" } });
    fireEvent.change(inputs[1], { target: { value: "rahman@example.com" } });
    fireEvent.change(inputs[2], { target: { value: "secret1" } });
    const form = container.querySelector("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form); // double tap
  }

  it("11. a dropped connection is not resent, so no duplicate account, and the user is told what to do", async () => {
    // Server is up (health answers) but the sign-up reply is lost: the account
    // may already exist, so sending it again would risk a duplicate.
    const calls = installFakeBackend((c) =>
      c.url === "/auth/me" ? appError(401, "Not authenticated") : c.url === "/health" ? ok() : "network-error"
    );
    const { container } = renderApp("/signup");
    await submitTeacherSignup(container);

    expect(await screen.findByText(/couldn't confirm your sign-up/i)).toBeTruthy();
    expect(count(calls, "/auth/register")).toBe(1);
  });

  it("11. during a cold start the sign-up waits and is sent to the app exactly once", async () => {
    const created: unknown[] = [];
    let start = Date.now();
    const calls = installFakeBackend((c) => {
      if (c.url === "/auth/me") return appError(401, "Not authenticated");
      if (Date.now() - start < 120) return RENDER_ASLEEP;
      if (c.url === "/auth/register") created.push(c.data);
      return c.url === "/auth/register" ? { status: 201, data: USER } : ok();
    });
    const { container } = renderApp("/signup");
    await screen.findByText("Create account");
    start = Date.now();
    await submitTeacherSignup(container);

    expect(await screen.findByText(STARTING_UP_MESSAGE)).toBeTruthy();
    expect(await screen.findByText("Dashboard")).toBeTruthy();
    expect(created).toHaveLength(1);
    expect(count(calls, "/auth/register")).toBe(2); // rejected by sleeping Render, then the real one
  });

  it("an existing email still shows the server's message", async () => {
    installFakeBackend((c) =>
      c.url === "/auth/me" ? appError(401, "Not authenticated") : appError(409, "An account with this email already exists")
    );
    const { container } = renderApp("/signup");
    await submitTeacherSignup(container);
    expect(await screen.findByText("An account with this email already exists")).toBeTruthy();
  });
});
