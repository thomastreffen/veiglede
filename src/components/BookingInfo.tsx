import { BedDouble, Users, Calendar, Wallet } from "lucide-react";
import type { Stop } from "@/lib/trips-store";
import { tripsApi } from "@/lib/trips-store";

type Status = NonNullable<NonNullable<Stop["booking"]>["status"]>;

export function bookingStatusMeta(status: Status | undefined) {
  switch (status) {
    case "paid":
      return { label: "Betalt", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" };
    case "booked":
      return { label: "Booket", cls: "border-amber-500/40 bg-amber-500/15 text-amber-300" };
    default:
      return { label: "Ikke booket", cls: "border-border bg-surface-2 text-muted-foreground" };
  }
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function BookingBadge({ status }: { status?: Status }) {
  const meta = bookingStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

/** Compact display of booking details for a lodging stop. */
export function BookingInfo({ booking }: { booking: Partial<NonNullable<Stop["booking"]>> }) {
  const nights = booking.nights ?? 1;
  const total = booking.pricePerNight ? booking.pricePerNight * nights : null;
  return (
    <div className="mt-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <BedDouble className="h-3 w-3" />
          {nights} {nights === 1 ? "natt" : "netter"}
          {booking.guests ? (
            <>
              <span aria-hidden>·</span>
              <Users className="h-3 w-3" /> {booking.guests}
            </>
          ) : null}
        </span>
        <BookingBadge status={booking.status} />
      </div>
      {(booking.checkinDate || booking.checkoutDate) && (
        <p className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {fmtDate(booking.checkinDate)}
          {booking.checkoutDate ? ` → ${fmtDate(booking.checkoutDate)}` : ""}
        </p>
      )}
      {total != null && (
        <p className="inline-flex items-center gap-1.5 font-mono tabular-nums text-foreground">
          <Wallet className="h-3 w-3 text-muted-foreground" />
          {booking.pricePerNight!.toFixed(0)} kr/natt
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold text-primary">{total.toFixed(0)} kr</span>
        </p>
      )}
    </div>
  );
}

/** Inline editor for booking fields, used on the stop detail page. */
export function BookingEditor({ stop }: { stop: Stop }) {
  if (stop.type !== "lodging") return null;
  const b = stop.booking ?? {};
  const input =
    "w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary";

  const update = (patch: Partial<NonNullable<Stop["booking"]>>) => {
    const next = { ...b, ...patch };
    if (next.checkinDate && next.checkoutDate) {
      const ms = new Date(next.checkoutDate).getTime() - new Date(next.checkinDate).getTime();
      const calcNights = Math.max(1, Math.round(ms / 86400000));
      if (!Number.isNaN(calcNights)) next.nights = calcNights;
    }
    tripsApi.updateStop(stop.id, { booking: next });
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <BedDouble className="h-3.5 w-3.5" /> Booking
        </p>
        <BookingBadge status={b.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Innsjekk</span>
          <input
            type="date"
            value={b.checkinDate ?? ""}
            onChange={(e) => update({ checkinDate: e.target.value || undefined })}
            className={input}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Utsjekk</span>
          <input
            type="date"
            value={b.checkoutDate ?? ""}
            min={b.checkinDate}
            onChange={(e) => update({ checkoutDate: e.target.value || undefined })}
            className={input}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Netter</span>
          <input
            type="number"
            min={1}
            value={b.nights ?? ""}
            onChange={(e) =>
              update({ nights: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })
            }
            className={input}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Gjester</span>
          <input
            type="number"
            min={1}
            value={b.guests ?? ""}
            onChange={(e) =>
              update({ guests: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })
            }
            className={input}
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          Pris per natt (NOK)
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="1"
          value={b.pricePerNight ?? ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value.replace(",", ".")) : undefined;
            update({ pricePerNight: v != null && !Number.isNaN(v) ? v : undefined });
          }}
          placeholder="0"
          className={input}
        />
        {b.pricePerNight != null && (b.nights ?? 1) > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Totalt: {(b.pricePerNight * (b.nights ?? 1)).toFixed(0)} kr
          </p>
        )}
      </label>

      <div>
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { v: "none", label: "Ikke booket" },
              { v: "booked", label: "Booket" },
              { v: "paid", label: "Betalt" },
            ] as { v: Status; label: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => update({ status: opt.v })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                (b.status ?? "none") === opt.v
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
