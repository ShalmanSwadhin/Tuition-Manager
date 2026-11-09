// A stand-in for the network in tests: replaces the axios adapter of the
// app's API client, so no test ever depends on Render (or any server) being up.
import { AxiosError, AxiosHeaders, CanceledError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import api from "../api/client";

export type Reply = { status: number; data?: unknown; headers?: Record<string, string> } | "network-error";

// Captured from production during a cold start (see the investigation report):
// Render's router answers for the sleeping service and tags the reply.
export const RENDER_ASLEEP: Reply = {
  status: 502,
  data: "<!DOCTYPE html><html><head><title>502</title></head></html>",
  headers: { "content-type": "text/html; charset=utf-8", "x-render-routing": "no-deploy" },
};
export const RENDER_WAKING: Reply = {
  status: 503,
  data: "<!doctype html><html><head><title>Render</title></head></html>",
  headers: { "content-type": "text/html; charset=utf-8", "x-render-routing": "hibernate-pending-wake" },
};
// A gateway error from somewhere other than Render (e.g. Vercel's proxy):
// the request may or may not have reached the app.
export const UNKNOWN_GATEWAY_ERROR: Reply = { status: 502, data: "Bad Gateway", headers: { "content-type": "text/plain" } };

export interface Call {
  method: string;
  url: string;
  data: unknown;
  at: number;
}

const originalAdapter = api.defaults.adapter;

export function installFakeBackend(handler: (config: InternalAxiosRequestConfig) => Reply): Call[] {
  const calls: Call[] = [];
  const adapter: AxiosAdapter = async (config) => {
    if (config.signal?.aborted) throw new CanceledError(undefined, undefined, config);
    calls.push({
      method: (config.method || "get").toUpperCase(),
      url: config.url || "",
      data: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
      at: Date.now(),
    });
    const reply = handler(config);
    if (reply === "network-error") throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
    const response = {
      data: reply.data,
      status: reply.status,
      statusText: "",
      headers: AxiosHeaders.from(reply.headers || { "content-type": "application/json" }),
      config,
      request: {},
    };
    if (reply.status >= 200 && reply.status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${reply.status}`,
      reply.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response
    );
  };
  api.defaults.adapter = adapter;
  return calls;
}

export function restoreBackend() {
  api.defaults.adapter = originalAdapter;
}

export const ok = (data: unknown = { ok: true }): Reply => ({ status: 200, data });
export const appError = (status: number, error: string): Reply => ({ status, data: { error } });
