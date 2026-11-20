// @vitest-environment jsdom
// What happens to a signed-in user when the session ends while the app is
// open, and that only genuine sessions are accepted.
import { describe, it, expect, afterEach } from "vitest";
import { useEffect, useState } from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import ProtectedRoute from "../components/ProtectedRoute";
import Login from "../pages/Login";
import api from "../api/client";
import { installFakeBackend, restoreBackend, ok, appError, type Call } from "../test/fakeBackend";

afterEach(() => {
  cleanup();
  restoreBackend();
});

const USER = { id: "u1", name: "Rahim", email: "rahim@example.com", role: "teacher", teacherKey: "K7M3QX" };
const count = (calls: Call[], url: string) => calls.filter((c) => c.url === url).length;

// A protected page that loads some data, like the real dashboard does.
function DataPage({ urls }: { urls: string[] }) {
  const [state, setState] = useState("loading");
  useEffect(() => {
    Promise.all(urls.map((u) => api.get(u)))
      .then(() => setState("loaded"))
      .catch(() => setState("failed"));
  }, [urls]);
  return <p>Data page: {state}</p>;
}

function ReloadButton() {
  const { retrySession } = useAuth();
  return <button onClick={retrySession}>Reload session</button>;
}

function renderApp(urls: string[] = ["/students"]) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={
                <>
                  <DataPage urls={urls} />
                  <ReloadButton />
                </>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("a session that ends while the app is open", () => {
  it("returns the user to the login page instead of leaving broken screens", async () => {
    installFakeBackend((c) => (c.url === "/auth/me" ? ok(USER) : appError(401, "Invalid or expired session")));
    renderApp();
    expect(await screen.findByText("Welcome back")).toBeTruthy();
  });

  it("several requests failing with 401 at once lead to a single, clean sign-out", async () => {
    const calls = installFakeBackend((c) => (c.url === "/auth/me" ? ok(USER) : appError(401, "Invalid or expired session")));
    renderApp(["/students", "/notices", "/dashboard/summary"]);
    expect(await screen.findByText("Welcome back")).toBeTruthy();
    // no retry storm: each request was made once, and the session wasn't re-checked in a loop
    for (const url of ["/students", "/notices", "/dashboard/summary"]) expect(count(calls, url)).toBe(1);
    expect(count(calls, "/auth/me")).toBe(1);
  });

  it("a 403 (signed in, but not allowed) does NOT sign the user out", async () => {
    installFakeBackend((c) => (c.url === "/auth/me" ? ok(USER) : appError(403, "You don't have access to this")));
    renderApp();
    expect(await screen.findByText("Data page: failed")).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
  });

  it("a healthy session keeps working", async () => {
    installFakeBackend((c) => (c.url === "/auth/me" ? ok(USER) : ok([])));
    renderApp();
    expect(await screen.findByText("Data page: loaded")).toBeTruthy();
  });

  it("a wrong password on the login page is not mistaken for an expired session", async () => {
    const calls = installFakeBackend((c) =>
      c.url === "/auth/me" ? appError(401, "Not authenticated") : appError(401, "Invalid email or password")
    );
    const { container } = renderApp();
    await screen.findByText("Welcome back");
    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: "rahim@example.com" } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
    expect(count(calls, "/auth/login")).toBe(1);
  });
});

describe("only a real session counts", () => {
  it("an HTML page answered with 200 is not treated as being signed in", async () => {
    installFakeBackend((c) =>
      c.url === "/auth/me" ? { status: 200, data: "<!doctype html><title>Hi</title>", headers: { "content-type": "text/html" } } : ok()
    );
    renderApp();
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
    expect(screen.queryByText(/Data page/)).toBeNull();
  });

  it("a login answered with something other than a user record shows an error, not a broken app", async () => {
    installFakeBackend((c) =>
      c.url === "/auth/me" ? appError(401, "Not authenticated") : { status: 200, data: "<!doctype html>", headers: { "content-type": "text/html" } }
    );
    const { container } = renderApp();
    await screen.findByText("Welcome back");
    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: "rahim@example.com" } });
    fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Login failed. Please try again.")).toBeTruthy();
    expect(screen.queryByText(/Data page/)).toBeNull();
  });

  it("after a reload (fresh session check) a valid cookie signs the user straight back in", async () => {
    let meCalls = 0;
    installFakeBackend((c) => (c.url === "/auth/me" ? (meCalls++, ok(USER)) : ok([])));
    renderApp();
    await screen.findByText("Data page: loaded");
    fireEvent.click(screen.getByText("Reload session"));
    await waitFor(() => expect(meCalls).toBe(2));
    expect(await screen.findByText("Data page: loaded")).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
  });
});
