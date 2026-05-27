import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useDriverPrefs, updateDriverPrefs, toggleDrivingFlag, toggleStopInterest, DRIVING_FLAGS, STOP_INTERESTS } from "@/lib/driver-prefs";
import { useVehicles, vehiclesApi, type Vehicle } from "@/lib/vehicles-store";
import { VehicleEditor } from "@/components/VehicleEditor";
import { Check, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [{ title: "Velkommen — Veiglede" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const prefs = useDriverPrefs();
  const { vehicles } = useVehicles();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const finish = async () => {
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        onboarded_at: new Date().toISOString(),
        display_name: prefs.displayName,
      });
    }
    navigate({ to: "/trips/new" });
  };

  const skip = async () => { await finish(); };

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-surface-2"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Steg 1 av 4</p>
          <h1 className="mt-2 font-display text-4xl uppercase">Velkommen til Veiglede</h1>
          <p className="mt-3 text-muted-foreground">
            Veiglede planlegger roadtrips tilpasset deg — kjørestil, kjøretøy og hvilke stopp du faktisk har lyst på. Vi setter opp profilen din på under et minutt.
          </p>
          <div className="mt-6 space-y-2 text-sm text-foreground">
            <Bullet>Personlige ruter basert på kjørestil og kjøretøy</Bullet>
            <Bullet>AI-genererte roadbooks med stopp som matcher deg</Bullet>
            <Bullet>Alt lagres på kontoen din — synkronisert mellom enheter</Bullet>
          </div>
          <NavRow onNext={() => setStep(2)} onSkip={skip} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Steg 2 av 4</p>
          <h1 className="mt-2 font-display text-3xl uppercase">Ditt første kjøretøy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vi har lagt inn noen eksempler — eller legg til ditt eget. Du kan endre dette når som helst.
          </p>

          <div className="mt-5 grid gap-2">
            {vehicles.slice(0, 4).map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3">
                <div className="h-10 w-10 grid place-items-center rounded-lg bg-surface-2 text-lg">
                  {v.type === "motorcycle" ? "🏍️" : v.type === "rv" ? "🚐" : "🚗"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.energy}</p>
                </div>
                <button
                  onClick={() => vehiclesApi.setDefault(v.id)}
                  className="text-xs px-2 py-1 rounded-md hover:bg-surface-2"
                >
                  Bruk som standard
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setEditorOpen(true)}
            className="mt-3 w-full rounded-xl border border-dashed border-border bg-transparent px-4 py-3 text-sm hover:bg-surface-2"
          >
            + Legg til ditt eget kjøretøy
          </button>

          <VehicleEditor open={editorOpen} onOpenChange={setEditorOpen} vehicle={undefined} />
          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={skip} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Steg 3 av 4</p>
          <h1 className="mt-2 font-display text-3xl uppercase">Din kjørestil</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Velg det som passer deg. Vi bruker det for å foreslå riktige ruter og stopp.
          </p>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vei og kjøring</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DRIVING_FLAGS.map((f) => {
                const on = prefs.drivingFlags[f.key];
                return (
                  <button key={f.key} onClick={() => toggleDrivingFlag(f.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <span>{f.emoji}</span> {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stopp jeg liker</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STOP_INTERESTS.map((s) => {
                const on = prefs.stopInterests.includes(s.value);
                return (
                  <button key={s.value} onClick={() => toggleStopInterest(s.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <span>{s.emoji}</span> {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="text-xs text-muted-foreground">Maks timer/dag</span>
              <input type="number" min={2} max={12} value={prefs.maxDrivingHours}
                onChange={(e) => updateDriverPrefs({ maxDrivingHours: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Pause hver (min)</span>
              <input type="number" min={45} max={240} step={15} value={prefs.pauseEveryMin}
                onChange={(e) => updateDriverPrefs({ pauseEveryMin: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-2 py-1.5"
              />
            </label>
          </div>

          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} onSkip={skip} />
        </Card>
      )}

      {step === 4 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Steg 4 av 4</p>
          <h1 className="mt-2 font-display text-3xl uppercase">Klar til å rulle</h1>
          <p className="mt-3 text-muted-foreground">
            Profilen din er satt opp. Vi har lagret alt på kontoen din — du kan endre når som helst i <Link to="/settings" className="underline text-foreground">profilen</Link>.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={finish} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
              <Sparkles className="h-4 w-4" /> Planlegg min første tur
            </button>
            <button onClick={async () => { if (user) await supabase.from("profiles").upsert({ id: user.id, onboarded_at: new Date().toISOString() }); navigate({ to: "/trips" }); }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-surface-2">
              Til mine turer
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-border bg-surface-1/70 p-6 md:p-8">{children}</div>;
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 text-primary" />
      <span>{children}</span>
    </div>
  );
}
function NavRow({ onBack, onNext, onSkip }: { onBack?: () => void; onNext: () => void; onSkip: () => void }) {
  return (
    <div className="mt-7 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Tilbake</button>
      ) : <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">Hopp over</button>}
      <button onClick={onNext} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
        Neste <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
