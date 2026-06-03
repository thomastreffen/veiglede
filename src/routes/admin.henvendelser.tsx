import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, ChevronDown, ChevronUp, Send, Lock } from "lucide-react";
import {
  adminListTicketsFn,
  adminUpdateTicketStatusFn,
  adminReplyTicketFn,
} from "@/lib/contact-tickets.functions";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/admin/henvendelser")({
  component: AdminTicketsPage,
});

type Ticket = {
  id: string;
  source: "kontaktskjema" | "partner" | "bruker" | "annet";
  status: "ny" | "åpen" | "besvart" | "lukket";
  name: string | null;
  email: string;
  subject: string | null;
  message: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

const SOURCE_LABEL: Record<Ticket["source"], string> = {
  kontaktskjema: "Kontaktskjema",
  partner: "Partner",
  bruker: "Bruker",
  annet: "Annet",
};

const STATUS_LABEL: Record<Ticket["status"], string> = {
  ny: "Ny",
  åpen: "Åpen",
  besvart: "Besvart",
  lukket: "Lukket",
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AdminTicketsPage() {
  const listFn = useServerFn(adminListTicketsFn);
  const updateFn = useServerFn(adminUpdateTicketStatusFn);
  const replyFn = useServerFn(adminReplyTicketFn);
  const qc = useQueryClient();

  const [status, setStatus] = useState<"alle" | Ticket["status"]>("alle");
  const [source, setSource] = useState<"alle" | Ticket["source"]>("alle");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", status, source],
    queryFn: () => listFn({ data: { status, source } }),
  });

  const updateStatus = useMutation({
    mutationFn: (v: { id: string; status: Ticket["status"] }) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-tickets-unread"] });
    },
  });

  const reply = useMutation({
    mutationFn: async (v: { id: string; reply: string }) => {
      const res = await replyFn({ data: v });
      if (res.ok && res.ticket) {
        await sendTransactionalEmail({
          templateName: "contact-reply",
          recipientEmail: res.ticket.email,
          idempotencyKey: `ticket-reply-${res.ticket.id}-${Date.now()}`,
          templateData: {
            name: res.ticket.name ?? undefined,
            subject: res.ticket.subject ?? undefined,
            originalMessage: res.ticket.message,
            reply: v.reply,
          },
        });
      }
      return res;
    },
    onSuccess: () => {
      toast.success("Svar sendt og merket besvart");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-tickets-unread"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke sende svar"),
  });

  if (isLoading) {
    return (
      <div className="py-20 grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const tickets = (data?.tickets ?? []) as Ticket[];
  const counts = data?.counts ?? { ny: 0, "åpen": 0, besvart: 0, lukket: 0, total: 0 };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Innboks</p>
        <h1 className="mt-1 font-display text-3xl uppercase">Henvendelser</h1>
        <p className="mt-2 text-sm text-slate-400">
          E-poster og kontaktskjema-meldinger til kontakt@veiglede.no.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ny" value={counts.ny} accent="orange" />
        <StatCard label="Åpen" value={counts["åpen"]} accent="blue" />
        <StatCard label="Besvart" value={counts.besvart} accent="emerald" />
        <StatCard label="Lukket" value={counts.lukket} accent="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["alle", "ny", "åpen", "besvart", "lukket"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              status === s
                ? "bg-primary text-primary-foreground"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            {s === "alle" ? "Alle" : STATUS_LABEL[s]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs uppercase tracking-wider text-slate-400">Kilde</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="alle">Alle</option>
            <option value="kontaktskjema">Kontaktskjema</option>
            <option value="partner">Partner</option>
            <option value="bruker">Bruker</option>
            <option value="annet">Annet</option>
          </select>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
          <Mail className="h-8 w-8 text-slate-500 mx-auto" />
          <p className="mt-3 text-sm text-slate-400">Ingen henvendelser i denne visningen.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <TicketRow
              key={t.id}
              ticket={t}
              onChangeStatus={(s) => updateStatus.mutate({ id: t.id, status: s })}
              onReply={(text) => reply.mutate({ id: t.id, reply: text })}
              replyPending={reply.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "orange" | "blue" | "emerald" | "slate";
}) {
  const accentCls = {
    orange: "text-orange-400",
    blue: "text-sky-400",
    emerald: "text-emerald-400",
    slate: "text-slate-300",
  }[accent];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-3xl ${accentCls}`}>{value}</p>
    </div>
  );
}

function TicketRow({
  ticket,
  onChangeStatus,
  onReply,
  replyPending,
}: {
  ticket: Ticket;
  onChangeStatus: (s: Ticket["status"]) => void;
  onReply: (text: string) => void;
  replyPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState("");

  const preview = (ticket.subject || ticket.message).slice(0, 80);
  const isNy = ticket.status === "ny";

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start gap-3 flex-wrap">
          {isNy && (
            <span className="rounded-full bg-orange-500/15 border border-orange-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
              Ny
            </span>
          )}
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-300">
            {SOURCE_LABEL[ticket.source]}
          </span>
          {!isNy && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
              {STATUS_LABEL[ticket.status]}
            </span>
          )}
          <span className="ml-auto text-[11px] text-slate-500">{fmtDate(ticket.created_at)}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-sm font-semibold text-slate-100 truncate">
            {ticket.name ?? ticket.email}
          </p>
          {ticket.name && (
            <p className="text-xs text-slate-500 truncate">{ticket.email}</p>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-300 truncate">{preview}</p>
        <div className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1">
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {open ? "Skjul" : "Vis full melding"}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-950/40">
          {ticket.subject && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Emne</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{ticket.subject}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Melding</p>
            <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{ticket.message}</p>
          </div>

          {ticket.admin_reply && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400">
                Tidligere svar {ticket.replied_at ? `· ${fmtDate(ticket.replied_at)}` : ""}
              </p>
              <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{ticket.admin_reply}</p>
            </div>
          )}

          {ticket.status !== "lukket" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500">
                Skriv svar (sendes til {ticket.email})
              </label>
              <textarea
                rows={5}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-primary focus:outline-none"
                placeholder="Hei, takk for henvendelsen…"
                maxLength={10000}
              />
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  disabled={!replyText.trim() || replyPending}
                  onClick={() => {
                    onReply(replyText.trim());
                    setReplyText("");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                >
                  {replyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Svar og merk besvart
                </button>
                <select
                  value={ticket.status}
                  onChange={(e) => onChangeStatus(e.target.value as Ticket["status"])}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="ny">Ny</option>
                  <option value="åpen">Åpen</option>
                  <option value="besvart">Besvart</option>
                  <option value="lukket">Lukket</option>
                </select>
                <button
                  type="button"
                  onClick={() => onChangeStatus("lukket")}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
                >
                  <Lock className="h-3.5 w-3.5" /> Lukk ticket
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
