import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/partner/")({
  head: () => ({
    meta: [
      { title: "Veiglede for partnere — nå kunder på veien" },
      {
        name: "description",
        content:
          "Selvbetjeningsportal for bedrifter som vil bli foreslått som stopp langs norske kjøreruter.",
      },
    ],
  }),
  component: PartnerLanding,
});

const BULLETS = [
  "Bli foreslått som stopp langs norske kjøreruter",
  "Nå motorsyklister, bobilister og bilturister aktivt",
  "Betal kun for visninger — ingen bindingstid",
  "Full kontroll via selvbetjeningsportal",
];

function PartnerLanding() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: "/partner/dashboard" });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 md:px-8 py-16 md:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.32em] text-primary">For partnere</p>
        <h1 className="mt-4 font-display text-4xl md:text-6xl uppercase leading-[0.95]">
          Nå dine kunder
          <br />
          <span className="text-primary">på veien.</span>
        </h1>
        <p className="mt-6 text-lg text-[#1a1a1a]/70 leading-relaxed max-w-md">
          Bli en del av Veiglede — den AI-drevne roadtrip-planleggeren for Norge.
          Selvbetjent, transparent og lokalt.
        </p>
        <ul className="mt-8 space-y-3">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm md:text-base">
              <span className="mt-1 grid place-items-center h-5 w-5 rounded-full bg-primary/15 text-primary shrink-0">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-[#1a1a1a]/85">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-black/5 bg-white shadow-xl p-7 md:p-9">
        <h2 className="font-display text-xl uppercase tracking-wide">Logg inn</h2>
        <p className="mt-1 text-sm text-[#1a1a1a]/60">Allerede partner? Logg inn under.</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#1a1a1a]/60 mb-1.5">
              E-post
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#1a1a1a]/60 mb-1.5">
              Passord
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Logg inn
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-black/5 text-sm text-[#1a1a1a]/65">
          Ikke partner enda?{" "}
          <Link to="/partner/register" className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
            Registrer bedrift <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
