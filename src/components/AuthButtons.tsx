import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Mail, Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

interface Props {
  mode: Mode;
  redirectTo?: string;
}

export function AuthButtons({ mode, redirectTo = "/trips" }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magic, setMagic] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

  const oauth = async (provider: "google" | "apple") => {
    setLoading(provider); setMsg(null);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: callbackUrl });
    if (result.error) {
      setMsg({ kind: "error", text: `Klarte ikke logge inn med ${provider}. Prøv igjen.` });
      setLoading(null);
      return;
    }
    if (result.redirected) return; // browser will navigate
    // tokens already set — go via callback so onboarding gate runs
    window.location.assign(callbackUrl);
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading("email"); setMsg(null);
    try {
      if (magic) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callbackUrl },
        });
        if (error) throw error;
        setMsg({ kind: "info", text: "Sjekk e-posten din — vi har sendt en magisk lenke." });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: callbackUrl },
        });
        if (error) throw error;
        setMsg({ kind: "info", text: "Bekreft e-posten din for å fullføre registreringen." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(callbackUrl);
      }
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Noe gikk galt." });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => oauth("google")}
          disabled={loading !== null}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {loading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Fortsett med Google
        </button>
        <button
          type="button"
          disabled
          title="Apple-innlogging krever Apple Developer-oppsett — kommer snart"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-1/60 px-4 py-2.5 text-sm font-medium opacity-60 cursor-not-allowed"
        >
          <AppleIcon />
          Fortsett med Apple
          <span className="ml-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Krever oppsett</span>
        </button>

      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> eller med e-post <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submitEmail} className="space-y-2">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="din@epost.no" autoComplete="email"
          className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        {!magic && (
          <input
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="passord (minst 6 tegn)" autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        )}
        <button
          type="submit" disabled={loading !== null}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          {loading === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {magic ? "Send magisk lenke" : mode === "signup" ? "Opprett konto" : "Logg inn"}
        </button>
      </form>

      <button
        type="button" onClick={() => { setMagic((m) => !m); setMsg(null); }}
        className="w-full text-xs text-muted-foreground hover:text-foreground"
      >
        {magic ? "Bruk passord i stedet" : "Send meg en magisk lenke i stedet"}
      </button>

      {msg && (
        <p className={msg.kind === "error" ? "text-sm text-destructive" : "text-sm text-foreground"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.2 7.9 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.5-8 19.5-20 0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.2 7.9 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5l-6-5.1A12 12 0 0 1 12.7 28l-6.5 5C9.5 39.5 16.1 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.4 5.9l6 5.1c-.4.3 6.6-4.8 6.6-15 0-1.3-.1-2.4-.4-3.5z"/></svg>
  );
}
function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-37 16.6-65 50.5-85.7-19-27.2-47.5-42.2-85.1-45.1-35.7-2.8-74.7 20.8-89 20.8-15.1 0-49.7-19.8-77-19.3-39.6.6-76.6 23-97.1 58.4-41.5 71.8-10.6 178 29.7 236.7 19.7 28.7 43 60.8 73.7 59.6 29.5-1.2 40.7-19.1 76.4-19.1 35.5 0 45.8 19.1 77.1 18.4 31.9-.5 52.1-29.1 71.6-57.9 22.6-33.2 31.9-65.5 32.4-67.2-.7-.4-62.1-23.8-62.2-94.6zM255 86.4c17.3-21 28.9-50.1 25.7-79-24.8 1-54.8 16.5-72.7 37.4-16 18.6-30 48.5-26.3 76.9 27.5 2.2 55.9-14 73.3-35.3z"/></svg>
  );
}
