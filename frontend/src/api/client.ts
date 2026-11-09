import axios from "axios";

// ---------------------------------------------------------------------------
// Cold-start recovery
//
// The API runs on Render's free tier, which puts it to sleep after 15 idle
// minutes. While it wakes (about 20–60 s) Render's router answers for it with
// a 502/503 HTML page, so requests fail even though nothing is wrong with
// them. Instead of surfacing that as an error, failed requests wait for the
// backend to come back and are then sent again -- but only when repeating
// them is safe:
//
// - "unreached": Render's router answered (it marks those replies with an
//   `x-render-routing` header), so the request never got to the app. Safe to
//   resend for any method, including POST.
// - "ambiguous": no reply at all, or a gateway error from somewhere else
//   (e.g. Vercel's proxy). The request may have reached the app and only the
//   reply was lost, so it is resent only if repeating it is harmless: GET/HEAD
//   by default, other methods only when the caller opts in via
//   `ambiguousRetries`.
//
// All waiting requests share one /api/health polling loop, and everything is
// bounded by a recovery window, after which the original error is rethrown.
// ---------------------------------------------------------------------------

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * How many times this request may be resent after an "ambiguous" failure
     * (see above). Defaults to unlimited (within the recovery window) for
     * GET/HEAD and 0 for every other method.
     */
    ambiguousRetries?: number;
    /** Internal: don't apply cold-start recovery (used by the health probe). */
    skipRecovery?: boolean;
    /** Internal: recovery bookkeeping carried across resends. */
    _recovery?: { deadline: number; ambiguousUsed: number };
  }
}

// Mutable so tests can shorten them; the app never changes these.
export const recoveryTiming = {
  intervalMs: 4_000, // pause between health checks
  windowMs: 90_000, // give up after this long
};

const api = axios.create({
  // Defaults to same-origin /api: proxied by Vite in dev and by the rewrite in
  // vercel.json in production. Set VITE_API_URL only to call the API directly.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // send the httpOnly JWT cookie
});

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export type FailureKind = "unreached" | "ambiguous";

// Our API always answers errors as JSON { error: "..." }; that is a real
// application response, never an infrastructure hiccup.
function isAppErrorBody(data: unknown): boolean {
  return typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string";
}

/** Classify a failed request as a transient infrastructure failure, or null for a genuine response. */
export function classifyFailure(error: unknown): FailureKind | null {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) return null;
  const res = error.response;
  if (!res) return "ambiguous"; // no reply: offline, connection dropped, DNS, ...
  if (!GATEWAY_STATUSES.has(res.status) || isAppErrorBody(res.data)) return null;
  return res.headers?.["x-render-routing"] ? "unreached" : "ambiguous";
}

/** True when a request failed because the server couldn't be reached, not because of what was sent. */
export function isBackendUnavailable(error: unknown): boolean {
  return classifyFailure(error) !== null;
}

function isSafeMethod(method?: string): boolean {
  const m = (method || "get").toLowerCase();
  return m === "get" || m === "head";
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new axios.CanceledError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// --- the shared recovery loop ------------------------------------------------

interface Recovery {
  done: Promise<boolean>; // true once /api/health answers, false if the window ran out or it was stopped
  stop: () => void;
  waiters: number;
}

let current: Recovery | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Subscribe to "is the app currently waiting for the backend to wake up". */
export function subscribeRecovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isRecovering(): boolean {
  return current !== null;
}

function startRecovery(): Recovery {
  const controller = new AbortController();
  const done = (async () => {
    const until = Date.now() + recoveryTiming.windowMs;
    try {
      while (Date.now() < until) {
        await sleep(Math.min(recoveryTiming.intervalMs, until - Date.now()), controller.signal);
        try {
          await api.get("/health", { skipRecovery: true, signal: controller.signal });
          return true;
        } catch {
          if (controller.signal.aborted) return false;
        }
      }
      return false;
    } catch {
      return false; // stopped while sleeping
    }
  })();

  const recovery: Recovery = {
    done,
    waiters: 0,
    stop: () => {
      controller.abort();
      release();
    },
  };
  // Detach as soon as it's over, so the next failure starts a fresh loop
  // instead of joining one that is shutting down.
  function release() {
    if (current === recovery) {
      current = null;
      emit();
    }
  }
  current = recovery;
  emit();
  done.then(release);
  return recovery;
}

/**
 * Wait until the backend answers its health check, the caller's deadline
 * passes (resolves false), or the caller's request is cancelled (rejects).
 */
function waitForBackend(deadline: number, signal?: AbortSignal): Promise<boolean> {
  const recovery = current ?? startRecovery();
  recovery.waiters++;

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(() => resolve(false)), Math.max(0, deadline - Date.now()));
    function onAbort() {
      finish(() => reject(new axios.CanceledError()));
    }
    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      recovery.waiters--;
      // Nobody is waiting any more (cancelled, navigated away, gave up):
      // stop polling rather than leave a loop running in the background.
      if (recovery.waiters === 0) recovery.stop();
      settle();
    }

    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    recovery.done.then((ok) => finish(() => resolve(ok)));
  });
}

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.config || error.config.skipRecovery) throw error;
  const config = error.config;
  const kind = classifyFailure(error);
  if (!kind) throw error;

  const state = config._recovery ?? { deadline: Date.now() + recoveryTiming.windowMs, ambiguousUsed: 0 };
  if (kind === "ambiguous") {
    const allowed = config.ambiguousRetries ?? (isSafeMethod(config.method) ? Infinity : 0);
    if (state.ambiguousUsed >= allowed) throw error;
  }
  if (Date.now() >= state.deadline) throw error;

  const ok = await waitForBackend(state.deadline, config.signal as AbortSignal | undefined);
  if (!ok) throw error;

  return api.request({
    ...config,
    _recovery: { deadline: state.deadline, ambiguousUsed: state.ambiguousUsed + (kind === "ambiguous" ? 1 : 0) },
  });
});

export default api;
