import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { consumeProfileDeletedNotice } from "@/lib/account";
import { useDriverPrefs, updateDriverPrefs, toggleDrivingFlag, toggleStopInterest, DRIVING_FLAGS, STOP_INTERESTS } from "@/lib/driver-prefs";
import { useVehicles, vehiclesApi, type Vehicle } from "@/lib/vehicles-store";
import { VehicleEditor } from "@/components/VehicleEditor";
import { Check, ArrowRight, Sparkles, Info } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [{ title: "Velkommen — Veiglede" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [freshAfterDelete, setFreshAfterDelete] = useState(false);
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();

  // Read the post-deletion notice exactly once, before any other effect can
  // clear localStorage.
  useEffect(() => {
    if (consumeProfileDeletedNotice()) setFreshAfterDelete(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [user, loading, navigate]);

  const getNext = (fallback: string) => {
    if (typeof window === "undefined") return fallback;
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
  };

  const finish = async (fallback = "/trips/new") => {
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        onboarded_at: new Date().toISOString(),
        display_name: prefs.displayName,
      });
    }
    const next = getNext(fallback);
    window.location.assign(next);
  };

  const skip = async () => { await finish("/trips"); };

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-surface-2"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          {freshAfterDelete && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
              <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Velkommen tilbake til Veiglede</p>
                <p className="mt-1 text-muted-foreground">
                  Google-kontoen din ble gjenkjent, men Veiglede-profilen din finnes ikke lenger. Vi setter derfor opp en ny profil for deg nå.
                </p>
              </div>
            </div>
          )}
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Steg 1 av 4</p>
          <h1 className="mt-2 font-display text-4xl uppercase">{freshAfterDelete ? "La oss sette opp profilen din på nytt" : "Velkommen til Veiglede"}</h1>
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
            Legg til ditt eget kjøretøy — eller bruk et eksempel under for å komme i gang. Du kan endre dette når som helst.
          </p>

          <button
            onClick={() => setEditorOpen(true)}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            + Legg til ditt eget kjøretøy
          </button>

          <div className="mt-4 grid gap-2">
            {vehicles.map((v) => {
              const isDefault = v.id === defaultId;
              return (
                <button
                  key={v.id}
                  onClick={() => vehiclesApi.setDefault(v.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${isDefault ? "border-primary bg-primary/10" : "border-border bg-surface-1 hover:border-border/80"}`}
                >
                  <div className="h-10 w-10 grid place-items-center rounded-lg bg-surface-2 text-lg shrink-0">
                    {v.type === "motorcycle" ? "🏍️" : v.type === "rv" ? "🚐" : "🚗"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      {v.isDemo && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">Eksempel</span>
                      )}
                      {!v.isDemo && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">Lagret</span>
                      )}
                      {isDefault && (
                        <span className="text-[10px] uppercase tracking-wider rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground">Standard</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {v.hint ?? `${v.energy}`}
                    </p>
                  </div>
                  {isDefault && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          <VehicleEditor
            open={editorOpen}
            onOpenChange={setEditorOpen}
            vehicle={undefined}
            onSaved={(v) => vehiclesApi.setDefault(v.id)}
          />
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
            <button onClick={() => finish()} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
              <Sparkles className="h-4 w-4" /> Planlegg min første tur
            </button>
            <button onClick={async () => { if (user) await supabase.from("profiles").upsert({ id: user.id, onboarded_at: new Date().toISOString() }); window.location.assign(getNext("/trips")); }}
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
