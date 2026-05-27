import { Link } from "@tanstack/react-router";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { AuthButtons } from "./AuthButtons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function SaveTripPrompt({ open, onOpenChange, title, description }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-xl">
            {title ?? "Vil du lagre turen din?"}
          </DialogTitle>
          <DialogDescription>
            {description ?? "Opprett en gratis konto for å lagre turer, kjøretøy og kjørestil — og komme tilbake til dem på alle enhetene dine."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <AuthButtons mode="signup" redirectTo="/trips" />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Har du allerede konto? <Link to="/login" className="text-foreground underline" onClick={() => onOpenChange(false)}>Logg inn</Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
