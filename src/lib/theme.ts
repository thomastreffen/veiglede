import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const KEY = "veiglede.theme";
const listeners = new Set<() => void>();

function read(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(KEY) as Theme) || "dark";
}

function apply(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", t === "light");
}

export function setTheme(t: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, t);
  apply(t);
  listeners.forEach((l) => l());
}

export function initTheme() {
  apply(read());
}

function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot(): Theme { return read(); }
function getServerSnapshot(): Theme { return "dark"; }

export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
