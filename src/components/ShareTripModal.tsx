import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Link2, Copy, Check, BookOpen, UserPlus, Globe, Lock,
  Radio, MapPin, Camera, Users, Eye,
} from "lucide-react";
import type { Trip } from "@/lib/trips-store";

interface Props {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareTripModal({ trip, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [companion, setCompanion] = useState("");
  const [invited, setInvited] = useState<string[]>([]);

  const base = typeof window !== "undefined" ? window.location.origin : "https://veiglede.app";
  const tripLink = `${base}/shared/${trip.id}`;
  const roadbookLink = `${base}/shared/${trip.id}?view=roadbook`;

  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const invite = () => {
    const v = companion.trim();
    if (!v) return;
    setInvited((p) => [...p, v]);
    setCompanion("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wide">
            Del turen
          </DialogTitle>
          <DialogDescription className="text-sm">
            Del ruta og roadbooken med venner, familie eller reisefølge.
          </DialogDescription>
        </DialogHeader>

        {/* Public toggle */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3.5">
          <span className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center shrink-0">
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-sm">{isPublic ? "Offentlig tur" : "Privat tur"}</p>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isPublic
                ? "Alle med lenken kan se ruta og roadbooken."
                : "Bare personer du inviterer kan åpne lenken."}
            </p>
          </div>
        </div>

        {/* Share link */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Delingslenke</p>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2 pl-3">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0 truncate text-xs font-mono">{tripLink}</span>
            <button
              onClick={() => copy("trip", tripLink)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
            >
              {copied === "trip" ? <><Check className="h-3.5 w-3.5" /> Kopiert</> : <><Copy className="h-3.5 w-3.5" /> Kopier</>}
            </button>
          </div>
          <button
            onClick={() => copy("roadbook", roadbookLink)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm hover:border-primary"
          >
            <BookOpen className="h-4 w-4 text-primary" />
            {copied === "roadbook" ? "Roadbook-lenke kopiert" : "Del roadbook"}
          </button>
          <Link
            to="/shared/$tripId"
            params={{ tripId: trip.id }}
            onClick={() => onOpenChange(false)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-primary hover:border-primary"
          >
            <Eye className="h-4 w-4" /> Forhåndsvis delt versjon
          </Link>
        </div>

        {/* Invite companion */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Reisefølge</p>
          <div className="flex items-center gap-2">
            <input
              value={companion}
              onChange={(e) => setCompanion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), invite())}
              placeholder="E-post eller navn…"
              className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={invite}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider hover:border-primary"
            >
              <UserPlus className="h-3.5 w-3.5" /> Inviter
            </button>
          </div>
          {invited.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {invited.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs">
                  <Users className="h-3 w-3 text-primary" /> {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Live sharing teaser */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary font-bold">
            <Radio className="h-3.5 w-3.5" /> Kommer: del turen live
          </p>
          <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
            Snart kan du dele reisen mens du er på veien — posisjon, siste stopp, neste stopp,
            bilder du tar underveis og små reiseoppdateringer til de som følger deg.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> Live posisjon</span>
            <span className="inline-flex items-center gap-1.5"><Camera className="h-3 w-3 text-primary" /> Bilder fra ruta</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-primary" /> Neste planlagte stopp</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-primary" /> Følgere & følge</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
