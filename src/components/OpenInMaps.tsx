import { useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";

interface Props {
  origin: string;
  destination: string;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function OpenInMaps({ origin, destination }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const o = encodeURIComponent(origin);
  const d = encodeURIComponent(destination);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const appleScheme = isIos() ? "maps://" : "https://maps.apple.com/";
  const links = [
    { label: "🗺️ Google Maps", href: `https://www.google.com/maps/dir/${o}/${d}` },
    { label: "🍎 Apple Maps", href: `${appleScheme}?saddr=${o}&daddr=${d}` },
    { label: "🧭 Waze", href: `https://waze.com/ul?q=${d}` },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3.5 text-sm font-medium hover:bg-surface-2 hover:border-primary"
      >
        <Navigation className="h-4 w-4" /> Naviger →
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-surface-2 hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
