import { useSyncExternalStore } from "react";
import { subscribeRecovery, isRecovering } from "./client";

/** True while requests are waiting for the sleeping backend to wake up. */
export function useServerWaking(): boolean {
  return useSyncExternalStore(subscribeRecovery, isRecovering);
}
