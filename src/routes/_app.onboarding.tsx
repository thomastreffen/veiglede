import { useEffect, useState, useCallback } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { consumeProfileDeletedNotice } from "@/lib/account";
import { useDriverPrefs, updateDriverPrefs, toggleDrivingFlag, toggleStopInterest, DRIVING_FLAGS, STOP_INTERESTS } from "@/lib/driver-prefs";
import { useVehicles, vehiclesApi, type Vehicle } from "@/lib/vehicles-store";
import { useTripsStore } from "@/lib/trips-store";
import { VehicleEditor } from "@/components/VehicleEditor";
import { UsernamePicker } from "@/components/UsernamePicker";
import { useT } from "@/i18n/provider";
import { Check, ArrowRight, Sparkles, Info } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [{ title: "Velkommen — Veiglede" }] }),
  component: Onboarding,
});

function Onboarding() {
  const t = useT();
  const ob = t.app.onboarding;
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [freshAfterDelete, setFreshAfterDelete] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();
  const { trips } = useTripsStore();

  const onUsernameChange = useCallback((v: string, ok: boolean) => {
    setUsername(v);
    setUsernameOk(ok);
  }, []);

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
        ...(usernameOk && username ? { username } : {}),
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
                <p className="font-semibold text-foreground">{ob.freshTitle}</p>
                <p className="mt-1 text-muted-foreground">{ob.freshBody}</p>
              </div>
            </div>
          )}
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{ob.stepOf(1, 4)}</p>
          <h1 className="mt-2 font-display text-4xl uppercase">{freshAfterDelete ? ob.welcomeBackTitle : ob.welcomeTitle}</h1>
          <p className="mt-3 text-muted-foreground">{ob.intro}</p>
          <div className="mt-6 space-y-2 text-sm text-foreground">
            <Bullet>{ob.bullet1}</Bullet>
            <Bullet>{ob.bullet2}</Bullet>
            <Bullet>{ob.bullet3}</Bullet>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">{ob.chooseUsername}</p>
            <UsernamePicker
              suggested={(user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name
                ?? (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name
                ?? user?.email?.split("@")[0]}
              ownUserId={user?.id}
              onChange={onUsernameChange}
            />
          </div>
          <NavRow onNext={() => setStep(2)} onSkip={skip} t={ob} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{ob.stepOf(2, 4)}</p>
          <h1 className="mt-2 font-display text-3xl uppercase">{ob.step2Title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{ob.step2Body}</p>

          <button
            onClick={() => setEditorOpen(true)}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            {ob.addVehicle}
          </button>

          {vehicles.length > 0 && (
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
                        {isDefault && (
                          <span className="text-[10px] uppercase tracking-wider rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground">{ob.defaultBadge}</span>
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
          )}

          <VehicleEditor
            open={editorOpen}
            onOpenChange={setEditorOpen}
            vehicle={undefined}
            onSaved={(v) => vehiclesApi.setDefault(v.id)}
          />
          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} onSkip={skip} t={ob} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{ob.stepOf(3, 4)}</p>
          <h1 className="mt-2 font-display text-3xl uppercase">{ob.step3Title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{ob.step3Body}</p>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{ob.roadAndDriving}</p>
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
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{ob.stopsILike}</p>
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
              <span className="text-xs text-muted-foreground">{ob.maxHoursPerDay}</span>
              <input type="number" min={2} max={12} value={prefs.maxDrivingHours}
                onChange={(e) => updateDriverPrefs({ maxDrivingHours: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{ob.pauseEveryMin}</span>
              <input type="number" min={45} max={240} step={15} value={prefs.pauseEveryMin}
                onChange={(e) => updateDriverPrefs({ pauseEveryMin: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-2 py-1.5"
              />
            </label>
          </div>

          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} onSkip={skip} t={ob} />
        </Card>
      )}

      {step === 4 && (
        <Card>
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary">{ob.stepOf(4, 4)}</p>
          <h1 className="mt-2 font-display text-3xl uppercase">{ob.step4Title}</h1>
          <p className="mt-3 text-muted-foreground">
            {ob.step4BodyPre}<Link to="/settings" className="underline text-foreground">{ob.step4BodyLink}</Link>{ob.step4BodyPost}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => finish()} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
              <Sparkles className="h-4 w-4" /> {ob.planFirstTrip}
            </button>
            <button onClick={async () => { if (user) await supabase.from("profiles").upsert({ id: user.id, onboarded_at: new Date().toISOString() }); window.location.assign(getNext(trips.length === 0 ? "/garage" : "/trips")); }}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-surface-2">
              {trips.length === 0 ? ob.toGarage : ob.toMyTrips}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-4">
            <p className="text-sm font-medium text-foreground">{ob.whatsNextTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ob.whatsNextBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/trips/new" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">
                {ob.planFirstTrip} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/explore" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs hover:bg-surface-2">
                {ob.exploreTrips} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/hjelp" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs hover:bg-surface-2">
                {ob.askHelpBot} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
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
function NavRow({ onBack, onNext, onSkip, t }: { onBack?: () => void; onNext: () => void; onSkip: () => void; t: { back: string; skip: string; next: string } }) {
  return (
    <div className="mt-7 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">{t.back}</button>
      ) : <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground">{t.skip}</button>}
      <button onClick={onNext} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
        {t.next} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
