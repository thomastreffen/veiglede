import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CornerDownRight, Route as RouteIcon, Bookmark, X } from "lucide-react";

export type DetourChoice = "detour" | "via" | "save" | "cancel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  location?: string;
  distanceFromRouteKm: number;
  extraDistanceKm: number;
  detourMin: number;
  onChoose: (choice: DetourChoice) => void;
}

/**
 * In-app modal that replaces window.confirm() for the "stop is far from
 * route" case. Lets the user decide whether to treat the stop as a
 * detour spur, a via-point on the main route, or just a saved suggestion.
 */
export function DetourPromptDialog({
  open, onOpenChange, name, location, distanceFromRouteKm, extraDistanceKm, detourMin, onChoose,
}: Props) {
  const pick = (c: DetourChoice) => {
    onChoose(c);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-surface p-0 max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500/15 via-surface to-surface px-5 pt-5 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase leading-tight">
              {name} ligger unna ruta
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground/80 mt-1">
              {location ? `${location} · ` : ""}{distanceFromRouteKm < 1 ? "<1 km" : `${distanceFromRouteKm} km`} fra hovedruta.
              Avstikker estimert: <span className="text-amber-400 font-semibold">+{extraDistanceKm} km / +{detourMin} min</span>.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-3 space-y-2">
          <p className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Hvordan vil du legge det til?</p>
          <ChoiceBtn
            icon={<RouteIcon className="h-4 w-4" />}
            title="Legg inn i ruta"
            sub="Hovedruta beregnes på nytt og går gjennom stedet."
            onClick={() => pick("via")}
            tone="primary"
          />
          <ChoiceBtn
            icon={<CornerDownRight className="h-4 w-4" />}
            title="Legg til som avstikker"
            sub="Tegnes som stiplet avstikker fra hovedruta. Hovedruta endres ikke."
            onClick={() => pick("detour")}
            tone="amber"
          />
          <ChoiceBtn
            icon={<Bookmark className="h-4 w-4" />}
            title="Bare lagre som forslag"
            sub="Legges i listen uten å påvirke ruta."
            onClick={() => pick("save")}
          />
          <button
            onClick={() => pick("cancel")}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Avbryt
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceBtn({
  icon, title, sub, onClick, tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  tone?: "amber" | "primary";
}) {
  const ring = tone === "amber"
    ? "border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10"
    : tone === "primary"
      ? "border-primary/40 hover:border-primary hover:bg-primary/10"
      : "border-border hover:border-foreground/40 hover:bg-background";
  const iconCls = tone === "amber" ? "text-amber-400" : tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border bg-surface-2/40 px-3 py-3 flex items-start gap-3 transition-colors ${ring}`}
    >
      <span className={`mt-0.5 ${iconCls}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{sub}</span>
      </span>
    </button>
  );
}
