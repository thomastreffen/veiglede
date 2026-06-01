import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, UtensilsCrossed, Bed, MountainSnow, Fuel, Store } from "lucide-react";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import { registerPartnerFn } from "@/lib/partner.functions";
import type { ResolvedPlace } from "@/lib/places/geocoder";

export const Route = createFileRoute("/partner/register")({
  head: () => ({
    meta: [{ title: "Registrer bedrift — Veiglede for partnere" }],
  }),
  component: RegisterPartner,
});

const CATEGORIES = [
  { key: "mat", label: "Mat & drikke", Icon: UtensilsCrossed },
  { key: "overnatting", label: "Overnatting", Icon: Bed },
  { key: "attraksjon", label: "Attraksjon", Icon: MountainSnow },
  { key: "drivstoff", label: "Drivstoff", Icon: Fuel },
  { key: "annet", label: "Annet", Icon: Store },
] as const;

type Form = {
  businessName: string;
  contactName: string;
  email: string;
  password: string;
  orgNumber: string;
  category: typeof CATEGORIES[number]["key"];
  website: string;
  description: string;
  logoFile: File | null;
  logoPreview: string | null;
  place: ResolvedPlace | null;
  placeText: string;
};

async function compressTo400(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    // cover fit
    const ratio = Math.max(400 / img.width, 400 / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    ctx.drawImage(img, (400 - w) / 2, (400 - h) / 2, w, h);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function RegisterPartner() {
  const register = useServerFn(registerPartnerFn);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    businessName: "",
    contactName: "",
    email: "",
    password: "",
    orgNumber: "",
    category: "mat",
    website: "",
    description: "",
    logoFile: null,
    logoPreview: null,
    place: null,
    placeText: "",
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.place) throw new Error("Velg en adresse");
      
      let logoUrl: string | null = null;
      if (form.logoFile) {
        const blob = await compressTo400(form.logoFile);
        const path = `${form.email}/logo.jpg`;
        const { error: upErr } = await supabase.storage
          .from("partner-logos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from("partner-logos").getPublicUrl(path);
          logoUrl = data.publicUrl;
        }
      }

      const res = await register({
        data: {
          email: form.email,
          password: form.password,
          businessName: form.businessName,
          contactName: form.contactName,
          orgNumber: form.orgNumber || null,
          category: form.category,
          website: form.website || null,
          logoUrl: logoUrl ?? null,
          description: form.description || null,
          address: form.place.label,
          region: form.place.region ?? null,
          lat: form.place.lat,
          lng: form.place.lng,
        },
      });
      
      if (!res.ok) throw new Error(res.error ?? "Registreringen feilet");
      await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      return res;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  if (submitted) {
    return (
      <section className="mx-auto max-w-2xl px-4 md:px-8 py-24 text-center">
        <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-primary/15 text-primary">
          <Check className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 font-display text-3xl md:text-4xl uppercase">Takk!</h1>
        <p className="mt-4 text-[#1a1a1a]/70 max-w-md mx-auto">
          Vi gjennomgår søknaden din og aktiverer kontoen innen 1–2 virkedager.
        </p>
        <Link
          to="/partner/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground"
        >
          Gå til dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  const canNext1 =
    form.businessName && form.contactName && form.email && form.password.length >= 8;
  const canNext2 = form.description.length <= 200;

  return (
    <section className="mx-auto max-w-2xl px-4 md:px-8 py-12 md:py-16">
      <div className="flex items-center gap-2 mb-10">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <span
              className={`grid place-items-center h-8 w-8 rounded-full text-xs font-bold ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-black/5 text-[#1a1a1a]/40"
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </span>
            {s < 3 && <div className={`flex-1 h-px ${step > s ? "bg-primary" : "bg-black/10"}`} />}
          </div>
        ))}
      </div>

      <h1 className="font-display text-2xl md:text-3xl uppercase">
        {step === 1 && "Bedriftsinformasjon"}
        {step === 2 && "Om bedriften"}
        {step === 3 && "Lokasjon"}
      </h1>
      <p className="mt-2 text-sm text-[#1a1a1a]/60">Steg {step} av 3</p>

      <div className="mt-8 space-y-5">
        {step === 1 && (
          <>
            <Field label="Bedriftsnavn">
              <input className={inputCls} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
            </Field>
            <Field label="Kontaktperson">
              <input className={inputCls} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="E-post">
                <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Passord (min 8)">
                <input type="password" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} />
              </Field>
            </div>
            <Field label="Organisasjonsnummer (valgfritt)">
              <input className={inputCls} value={form.orgNumber} onChange={(e) => set("orgNumber", e.target.value)} />
            </Field>
            <div>
              <label className={labelCls}>Kategori</label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CATEGORIES.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("category", key)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs ${
                      form.category === key
                        ? "border-primary bg-primary/5 text-[#1a1a1a]"
                        : "border-black/10 text-[#1a1a1a]/70 hover:border-black/20"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Nettside">
              <input
                type="url"
                placeholder="https://"
                className={inputCls}
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
            <div>
              <label className={labelCls}>Logo</label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl bg-black/5 grid place-items-center overflow-hidden border border-black/5">
                  {form.logoPreview ? (
                    <img src={form.logoPreview} alt="logo" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-[#1a1a1a]/40" />
                  )}
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-black/10 text-sm cursor-pointer hover:bg-black/5">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      set("logoFile", f);
                      set("logoPreview", f ? URL.createObjectURL(f) : null);
                    }}
                  />
                  Velg bilde
                </label>
              </div>
              <p className="mt-2 text-xs text-[#1a1a1a]/55">Komprimeres til 400×400.</p>
            </div>
            <Field label={`Kort beskrivelse (${form.description.length}/200)`}>
              <textarea
                rows={3}
                maxLength={200}
                className={`${inputCls} resize-none`}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Vises til Veiglede-brukere..."
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className={labelCls}>Adresse</label>
              <div className="mt-2">
                <PlaceAutocomplete
                  value={form.placeText}
                  onTextChange={(t) => set("placeText", t)}
                  selected={form.place}
                  onSelect={(p) => set("place", p)}
                  placeholder="Søk etter adresse..."
                />
              </div>
            </div>
            {form.place && (
              <div className="rounded-xl border border-black/10 bg-white p-4 text-sm">
                <div className="font-semibold">{form.place.label}</div>
                <div className="text-xs text-[#1a1a1a]/55 mt-1">
                  {form.place.lat.toFixed(4)}, {form.place.lng.toFixed(4)}
                </div>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm text-[#1a1a1a]/70 hover:bg-black/5 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            Neste <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!form.place || submit.isPending}
            onClick={() => submit.mutate()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Fullfør registrering
          </button>
        )}
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none";
const labelCls = "block text-xs uppercase tracking-wider text-[#1a1a1a]/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
