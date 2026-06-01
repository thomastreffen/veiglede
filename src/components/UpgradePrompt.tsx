import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PRO_FEATURE_LABELS, type ProFeature } from "@/lib/subscription";

export function UpgradePrompt({
  open,
  onOpenChange,
  feature,
  customMessage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature: ProFeature;
  customMessage?: string;
}) {
  const info = PRO_FEATURE_LABELS[feature];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-primary/30">
        <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Pro
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Lukk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogTitle className="mt-4 font-display text-2xl uppercase">{info.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {customMessage ?? info.desc}
          </DialogDescription>
        </div>
        <div className="p-6 pt-2 space-y-3">
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>✓ Ubegrenset turer og kjøretøy</li>
            <li>✓ Live-deling, PDF, AI-pakkeliste, kostnadskalkulator</li>
            <li>✓ Pro-badge på offentlig profil</li>
            <li>✓ Bytt eller avbryt når som helst</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Link
              to="/pricing"
              onClick={() => onOpenChange(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
            >
              <Sparkles className="h-4 w-4" /> Oppgrader til Pro
            </Link>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-surface-2"
            >
              Kanskje senere
            </button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground pt-1">
            Fra 79 kr/mnd · Betaling aktiveres snart
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
