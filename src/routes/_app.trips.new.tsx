import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ModeSelect } from "@/components/wizard/ModeSelect";
import { ManualWizard } from "@/components/wizard/ManualWizard";
import { AiWizard } from "@/components/wizard/AiWizard";

type WizardMode = "ai" | "manual";

export const Route = createFileRoute("/_app/trips/new")({
  head: () => ({ meta: [{ title: "Ny tur — Veiglede" }] }),
  validateSearch: (s: Record<string, unknown>): { mode?: WizardMode } => {
    const modeRaw = typeof s.mode === "string" ? s.mode.toLowerCase() : undefined;
    const mode: WizardMode | undefined = modeRaw === "ai" || modeRaw === "manual" ? modeRaw : undefined;
    return { mode };
  },
  component: NewTripRoute,
});

function NewTripRoute() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const goHome = () => navigate({ to: "/trips/new", search: {}, replace: true });
  if (!mode) {
    return (
      <ModeSelect
        onSelect={(m) => navigate({ to: "/trips/new", search: { mode: m }, replace: true })}
      />
    );
  }
  if (mode === "manual") return <ManualWizard onBack={goHome} />;
  return <AiWizard onBack={goHome} />;
}
