"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { applyCommand } from "./_domain/engine";
import type { CommandResult, FlowCommand, FlowState, Scenario } from "./_domain/types";

// Only fictional prototype data. The real application never reads this key.
const PREFIX = "anajak:production-flow-proto:v1:";
const CHANGE = "production-flow-proto-change";
const memory = new Map<string, string>();
const clientReady = () => true;
const serverReady = () => false;
const subscribeReady = () => () => {};
function read(key: string) {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
function write(key: string, value: string) {
  memory.set(key, value);
  try { window.localStorage.setItem(key, value); } catch { /* Private browser: session memory still works. */ }
  window.dispatchEvent(new Event(CHANGE));
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(CHANGE, callback); };
}
function restore(value: string | null, fallback: FlowState): FlowState {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as FlowState;
    return Array.isArray(parsed.orders) && Array.isArray(parsed.operations) && Array.isArray(parsed.lots)
      && Array.isArray(parsed.films) && Array.isArray(parsed.history) && typeof parsed.revision === "number"
      && typeof parsed.processedCommands === "object" ? parsed : fallback;
  } catch { return fallback; }
}

export function useFlowState(scenario: Scenario) {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const key = PREFIX + scenario.id;
  const initial = useMemo(() => scenario.createState(), [scenario]);
  const serialized = useSyncExternalStore(subscribe, () => read(key), () => null);
  const state = useMemo(() => restore(serialized, initial), [serialized, initial]);
  const command = useCallback((input: FlowCommand): CommandResult => {
    const current = restore(read(key), initial);
    const result = applyCommand(current, input);
    if (!result.error && !result.duplicate) write(key, JSON.stringify(result.state));
    return result;
  }, [key, initial]);
  const reset = useCallback(() => write(key, JSON.stringify(scenario.createState())), [key, scenario]);
  return { state, command, reset, ready };
}
