// Platform detection. Currently always "web" — prepared for Capacitor.
import { useSyncExternalStore } from "react";

export type Platform = "web" | "ios" | "android";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function readCapacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap ?? null;
}

export function getPlatform(): Platform {
  const cap = readCapacitor();
  if (!cap?.isNativePlatform?.()) return "web";
  const p = cap.getPlatform?.();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}

export function isNative(): boolean {
  return getPlatform() !== "web";
}

// React hook. Platform never changes at runtime, so this is effectively static,
// but exposing it as a hook keeps call sites stable for a future native build.
const subscribe = () => () => {};
const getSnapshot = () => isNative();
const getServerSnapshot = () => false;

export function useIsNative(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
