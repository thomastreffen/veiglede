import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { USERNAME_RE } from "@/lib/profiles.functions";
import { Check, X, Loader2 } from "lucide-react";

interface Props {
  initialValue?: string;
  /** Suggested seed (e.g. from Google display name) used when input is empty. */
  suggested?: string;
  /** Current user id, so we don't flag our own username as "taken". */
  ownUserId?: string;
  onChange: (value: string, ok: boolean) => void;
}

export function suggestUsername(seed: string | undefined): string {
  if (!seed) return "";
  return seed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function UsernamePicker({ initialValue, suggested, ownUserId, onChange }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<Status>("idle");

  // Seed with suggestion only if empty on mount
  useEffect(() => {
    if (!initialValue && suggested && !value) {
      setValue(suggestUsername(suggested));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v) { setStatus("idle"); onChange("", false); return; }
    if (!USERNAME_RE.test(v) || v.length < 3 || v.length > 20) {
      setStatus("invalid");
      onChange(v, false);
      return;
    }
    setStatus("checking");
    onChange(v, false);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", v)
        .maybeSingle();
      if (error) { setStatus("idle"); return; }
      if (!data || (ownUserId && data.id === ownUserId)) {
        setStatus("available");
        onChange(v, true);
      } else {
        setStatus("taken");
        onChange(v, false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [value, ownUserId, onChange]);

  return (
    <div>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Brukernavn</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">veiglede.no/u/</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20))}
            placeholder="ditt-navn"
            className="w-full bg-surface-1 border border-border rounded-xl pl-[140px] pr-10 py-2.5 text-sm outline-none focus:border-primary"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
            {status === "available" && <Check className="h-4 w-4 text-primary" />}
            {(status === "taken" || status === "invalid") && <X className="h-4 w-4 text-destructive" />}
          </span>
        </div>
      </label>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {status === "available" && <span className="text-primary">Ledig — ser bra ut!</span>}
        {status === "taken" && <span className="text-destructive">Det brukernavnet er tatt</span>}
        {status === "invalid" && <span className="text-destructive">3–20 tegn, kun a–z, 0–9 og bindestrek (ikke i start/slutt)</span>}
        {(status === "idle" || status === "checking") && <span>3–20 tegn, små bokstaver og bindestrek. Synlig på din offentlige profil.</span>}
      </p>
    </div>
  );
}
