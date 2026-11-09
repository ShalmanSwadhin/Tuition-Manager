import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import api, { isBackendUnavailable, isRecovering } from "./client";
import {
  installFakeBackend,
  restoreBackend,
  RENDER_ASLEEP,
  RENDER_WAKING,
  UNKNOWN_GATEWAY_ERROR,
  ok,
  appError,
  type Reply,
} from "../test/fakeBackend";

// Real production timings (4 s between health checks, 90 s window), on a fake clock.
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  restoreBackend();
});

// A backend that is asleep until `wakeAt` ms from now, then answers normally.
function backendWakingAt(wakeAt: number, asleep: Reply = RENDER_ASLEEP, awake: (url: string) => Reply = () => ok()) {
  const start = Date.now();
  return installFakeBackend((config) => (Date.now() - start < wakeAt ? asleep : awake(config.url || "")));
}

// Settle a request while the fake clock runs, without unhandled-rejection noise.
async function run<T>(promise: Promise<T>, ms = 120_000) {
  const outcome = promise.then(
    (value) => ({ value, error: undefined as unknown }),
    (error) => ({ value: undefined as T | undefined, error })
  );
  await vi.advanceTimersByTimeAsync(ms);
  return outcome;
}

const urls = (calls: { url: string }[], url: string) => calls.filter((c) => c.url === url).length;

describe("cold-start recovery", () => {
  it("1. backend answers 200 straight away: one request, no waiting", async () => {
    const calls = installFakeBackend(() => ok({ id: "u1" }));
    const { value } = await run(api.get("/auth/me"), 0);
    expect(value?.data).toEqual({ id: "u1" });
    expect(calls).toHaveLength(1);
  });

  it("2. backend returns 502 three times, then 200: the request succeeds", async () => {
    let failures = 3;
    const calls = installFakeBackend(() => (failures-- > 0 ? RENDER_ASLEEP : ok({ id: "u1" })));

    const { value, error } = await run(api.get("/auth/me"));

    expect(error).toBeUndefined();
    expect(value?.data).toEqual({ id: "u1" });
    // 1 failed request + 2 failed health checks + 1 good health check + 1 resend
    expect(urls(calls, "/auth/me")).toBe(2);
    expect(urls(calls, "/health")).toBe(3);
    // health checks are spaced by the 4 s interval
    const healthTimes = calls.filter((c) => c.url === "/health").map((c) => c.at);
    expect(healthTimes[1] - healthTimes[0]).toBe(4000);
  });

  it("3. backend answers 503 (Render waking page) and recovers after ~25 s", async () => {
    const calls = backendWakingAt(25_000, RENDER_WAKING, () => ok({ id: "u1" }));
    const t0 = Date.now();
    let settledAt = 0;
    const { value } = await run(api.get("/auth/me").finally(() => (settledAt = Date.now())));
    expect(value?.status).toBe(200);
    expect(settledAt - t0).toBeGreaterThanOrEqual(25_000);
    expect(settledAt - t0).toBeLessThanOrEqual(30_000);
    expect(urls(calls, "/auth/me")).toBe(2);
  });

  it("4. backend unavailable for the whole window: gives up at 90 s and stops", async () => {
    const calls = installFakeBackend(() => RENDER_ASLEEP);
    const t0 = Date.now();
    let settledAt = 0;
    const { error } = await run(api.get("/auth/me").finally(() => (settledAt = Date.now())), 95_000);

    expect(isBackendUnavailable(error)).toBe(true);
    expect((error as any).response.status).toBe(502); // the original failure, not a made-up one
    expect(settledAt - t0).toBe(90_000);
    expect(isRecovering()).toBe(false);

    const after = calls.length;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(calls.length).toBe(after); // nothing keeps polling in the background
    expect(after).toBeLessThanOrEqual(1 + 90_000 / 4_000 + 1);
  });

  it.each([400, 401, 403, 404, 409, 422, 429])("%i is a real answer: no retry, no waiting", async (status) => {
    const calls = installFakeBackend(() => appError(status, "nope"));
    const { error } = await run(api.get("/auth/me"), 0);
    expect((error as any).response.status).toBe(status);
    expect(isBackendUnavailable(error)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("a 502/503/504 that our own API sent (JSON error body) is not retried", async () => {
    for (const status of [502, 503, 504]) {
      const calls = installFakeBackend(() => appError(status, "Upstream thing failed"));
      const { error } = await run(api.get("/students"), 0);
      expect((error as any).response.data.error).toBe("Upstream thing failed");
      expect(calls).toHaveLength(1);
    }
  });

  it("500 is not treated as the server sleeping", async () => {
    const calls = installFakeBackend(() => appError(500, "Internal server error"));
    const { error } = await run(api.get("/auth/me"), 0);
    expect(isBackendUnavailable(error)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("GETs also recover from a dropped connection or a non-Render gateway error", async () => {
    for (const failure of ["network-error", UNKNOWN_GATEWAY_ERROR] as Reply[]) {
      let first = true;
      const calls = installFakeBackend(() => (first ? ((first = false), failure) : ok()));
      const { value } = await run(api.get("/students"));
      expect(value?.status).toBe(200);
      expect(urls(calls, "/students")).toBe(2);
    }
  });

  it("keeps cookies/credentials on resends", async () => {
    let failures = 1;
    const seen: (boolean | undefined)[] = [];
    installFakeBackend((config) => {
      if (config.url === "/auth/me") seen.push(config.withCredentials);
      return failures-- > 0 ? RENDER_ASLEEP : ok();
    });
    await run(api.get("/auth/me"));
    expect(seen).toEqual([true, true]);
  });
});

describe("POST requests are only resent when that is safe", () => {
  const signup = { role: "teacher", name: "T", email: "t@example.com", password: "secret1" };

  it("11. sign-up rejected by sleeping Render is resent and creates exactly one account", async () => {
    const created: unknown[] = [];
    const start = Date.now();
    installFakeBackend((config) => {
      if (Date.now() - start < 10_000) return RENDER_ASLEEP; // never reaches the app
      if (config.url === "/auth/register") created.push(JSON.parse(config.data));
      return ok({ id: "new" });
    });

    const { value } = await run(api.post("/auth/register", signup));

    expect(value?.status).toBe(200);
    expect(created).toEqual([signup]);
  });

  it("11. sign-up is NOT resent after a dropped connection (it may already have created the account)", async () => {
    const calls = installFakeBackend(() => "network-error");
    const { error } = await run(api.post("/auth/register", signup));
    expect(isBackendUnavailable(error)).toBe(true);
    expect(urls(calls, "/auth/register")).toBe(1);
    expect(urls(calls, "/health")).toBe(0);
  });

  it("11. sign-up is NOT resent after a gateway error that might have come after the app", async () => {
    const calls = installFakeBackend(() => UNKNOWN_GATEWAY_ERROR);
    await run(api.post("/auth/register", signup));
    expect(urls(calls, "/auth/register")).toBe(1);
  });

  it("other writes (e.g. marking attendance) follow the same rule", async () => {
    const calls = installFakeBackend(() => "network-error");
    await run(api.post("/classes/toggle", { student: "s", date: "2026-11-01" }));
    expect(urls(calls, "/classes/toggle")).toBe(1);
  });

  it("login opts in to a bounded 2 resends after a dropped connection", async () => {
    // Server is up (health answers) but every login reply gets lost.
    const calls = installFakeBackend((config) => (config.url === "/health" ? ok() : "network-error"));
    const { error } = await run(api.post("/auth/login", { email: "a@b.co", password: "x" }, { ambiguousRetries: 2 }));
    expect(isBackendUnavailable(error)).toBe(true);
    expect(urls(calls, "/auth/login")).toBe(3);
  });
});

describe("one recovery for everyone, and cleanup", () => {
  it("12. several requests failing together share a single health-check loop", async () => {
    const calls = backendWakingAt(10_000);

    const results = await run(Promise.all([api.get("/auth/me"), api.get("/students"), api.get("/notices")]));

    expect(results.error).toBeUndefined();
    // health checks at 4 s and 8 s (asleep) and 12 s (awake) -- once, not once per request
    expect(urls(calls, "/health")).toBe(3);
    for (const url of ["/auth/me", "/students", "/notices"]) expect(urls(calls, url)).toBe(2);
  });

  it("12. a request failing while recovery is already under way joins it", async () => {
    const calls = backendWakingAt(10_000);
    const first = api.get("/auth/me");
    await vi.advanceTimersByTimeAsync(5_000);
    const second = api.get("/students");
    await run(Promise.all([first, second]));
    expect(urls(calls, "/health")).toBe(3);
  });

  it("13. cancelling a waiting request stops it and the background polling", async () => {
    const calls = installFakeBackend(() => RENDER_ASLEEP);
    const controller = new AbortController();
    const request = api.get("/auth/me", { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(isRecovering()).toBe(true);
    controller.abort();
    const { error } = await run(request, 0);

    expect(axios.isCancel(error)).toBe(true);
    expect(isRecovering()).toBe(false);
    const after = calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls.length).toBe(after);
  });

  it("13. polling continues while at least one request still waits", async () => {
    const calls = backendWakingAt(10_000);
    const controller = new AbortController();
    const cancelled = api.get("/students", { signal: controller.signal });
    const kept = api.get("/auth/me");
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    const results = await run(Promise.allSettled([cancelled, kept]));
    expect(results.value?.[0].status).toBe("rejected");
    expect(results.value?.[1].status).toBe("fulfilled");
    expect(urls(calls, "/students")).toBe(1);
  });
});
