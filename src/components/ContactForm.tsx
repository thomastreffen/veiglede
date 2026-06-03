import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Check, Send } from "lucide-react";
import { submitContactTicketFn } from "@/lib/contact-tickets.functions";

interface ContactFormProps {
  source?: "kontaktskjema" | "partner" | "bruker" | "annet";
  className?: string;
  /** Visual variant — light = on light backgrounds (landing). dark = on dark surfaces. */
  variant?: "light" | "dark";
}

export function ContactForm({ source = "kontaktskjema", className = "", variant = "light" }: ContactFormProps) {
  const submit = useServerFn(submitContactTicketFn);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          name: name.trim() || null,
          email: email.trim(),
          subject: subject.trim() || null,
          message: message.trim(),
          source,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setDone(true);
      }
    },
  });

  const isLight = variant === "light";
  const inputCls = isLight
    ? "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#1a1a1a] focus:border-primary focus:outline-none"
    : "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none";
  const labelCls = isLight
    ? "block text-xs uppercase tracking-wider text-[#1a1a1a]/60"
    : "block text-xs uppercase tracking-wider text-muted-foreground";

  if (done) {
    return (
      <div className={`rounded-2xl border ${isLight ? "border-emerald-200 bg-emerald-50" : "border-emerald-400/40 bg-emerald-400/10"} p-6 text-center ${className}`}>
        <div className="mx-auto h-10 w-10 grid place-items-center rounded-full bg-emerald-500/20 text-emerald-700">
          <Check className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <p className={`mt-4 font-semibold ${isLight ? "text-[#1a1a1a]" : "text-foreground"}`}>
          Takk! Vi svarer innen 1–2 virkedager.
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#1a1a1a]/70" : "text-muted-foreground"}`}>
          Bekreftelse er sendt til {email}.
        </p>
      </div>
    );
  }

  const canSubmit =
    email.includes("@") && message.trim().length > 0 && !mut.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mut.mutate();
      }}
      className={`space-y-4 text-left ${className}`}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Navn (valgfritt)</label>
          <input
            className={`mt-1.5 ${inputCls}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            autoComplete="name"
          />
        </div>
        <div>
          <label className={labelCls}>E-post *</label>
          <input
            type="email"
            required
            className={`mt-1.5 ${inputCls}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Emne (valgfritt)</label>
        <input
          className={`mt-1.5 ${inputCls}`}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>
      <div>
        <label className={labelCls}>Melding *</label>
        <textarea
          required
          rows={5}
          className={`mt-1.5 ${inputCls} resize-none`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={5000}
          placeholder="Hva kan vi hjelpe deg med?"
        />
        <p className={`mt-1 text-[11px] ${isLight ? "text-[#1a1a1a]/50" : "text-muted-foreground"}`}>
          {message.length}/5000
        </p>
      </div>
      {mut.isError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {mut.error instanceof Error ? mut.error.message : "Kunne ikke sende meldingen — prøv igjen."}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold uppercase tracking-wider disabled:opacity-50 ${
          isLight
            ? "bg-[#1a1a1a] text-white hover:bg-[#1a1a1a]/90"
            : "bg-primary text-primary-foreground hover:brightness-110"
        }`}
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send melding
      </button>
    </form>
  );
}
