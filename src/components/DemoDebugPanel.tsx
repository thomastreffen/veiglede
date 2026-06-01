import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const KEY = "veiglede_debug";
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) l(); };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
function getSnapshot() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}
function getServerSnapshot() { return false; }

export function useDebugMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setDebugMode(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

interface DemoDebugPanelProps {
  title?: string;
  items: Array<{ label: string; value: string | number | null | undefined }>;
  className?: string;
}

export function DemoDebugPanel({ title = "Demo status", items, className }: DemoDebugPanelProps) {
  const on = useDebugMode();
  if (!on) return null;
  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 mb-4",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[11px]"
          >
            <span className="uppercase tracking-wider text-muted-foreground">{item.label}</span>
            <span className="font-medium text-foreground">{item.value ?? "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
