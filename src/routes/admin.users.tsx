import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminListUsersFn,
  adminSetUserRoleFn,
  adminSetUserActiveFn,
  adminGetUserDetailsFn,
  adminListAuditLogFn,
} from "@/lib/admin.functions";
import { adminSetUserPlanFn } from "@/lib/subscription.functions";
import {
  Search,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  ExternalLink,
  Mail,
  Download,
  Car,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type SortKey = "created_at" | "display_name" | "tripCount";
type PlanFilter = "all" | "free" | "pro" | "gruppe" | "admin" | "inactive";

const PLAN_LABEL: Record<string, string> = { free: "Gratis", pro: "Pro", gruppe: "Gruppe" };
const ACTION_LABEL: Record<string, string> = {
  set_plan: "endret plan for",
  activate: "aktiverte",
  deactivate: "deaktiverte",
  add_admin: "ga admin til",
  remove_admin: "fjernet admin fra",
};

function AdminUsers() {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Administrasjon</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Brukere</h1>
      </header>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Brukere</TabsTrigger>
          <TabsTrigger value="audit">Aktivitetslogg</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-5">
          <UsersTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-5">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
   USERS TAB
   ========================================================================= */

function UsersTab() {
  const list = useServerFn(adminListUsersFn);
  const setRole = useServerFn(adminSetUserRoleFn);
  const setActive = useServerFn(adminSetUserActiveFn);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [desc, setDesc] = useState(true);
  const [filter, setFilter] = useState<PlanFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => list({ data: { search: search || undefined } }),
    staleTime: 10_000,
  });

  const users = useMemo(() => {
    const rows = data?.users ?? [];
    let filtered = rows;
    if (filter === "admin") filtered = rows.filter((u) => u.role === "admin");
    else if (filter === "inactive") filtered = rows.filter((u) => u.is_active === false);
    else if (filter !== "all") filtered = rows.filter((u) => (u.plan ?? "free") === filter);

    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] as number | string | null;
      const bv = b[sortKey] as number | string | null;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return desc ? bv - av : av - bv;
      return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return sorted;
  }, [data, sortKey, desc, filter]);

  const counts = useMemo(() => {
    const all = data?.users ?? [];
    return {
      all: all.length,
      free: all.filter((u) => (u.plan ?? "free") === "free").length,
      pro: all.filter((u) => u.plan === "pro").length,
      gruppe: all.filter((u) => u.plan === "gruppe").length,
      admin: all.filter((u) => u.role === "admin").length,
      inactive: all.filter((u) => u.is_active === false).length,
    };
  }, [data]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDesc(!desc);
    else { setSortKey(k); setDesc(true); }
  };

  const onRole = async (userId: string, role: "user" | "admin") => {
    try {
      await setRole({ data: { userId, role } });
      toast.success(role === "admin" ? "Gjort til admin" : "Admin fjernet");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  const onActive = async (userId: string, isActive: boolean) => {
    try {
      await setActive({ data: { userId, isActive } });
      toast.success(isActive ? "Konto aktivert" : "Konto deaktivert");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  };

  const selectedRows = users.filter((u) => selected.has(u.id));

  const onBulkMail = () => {
    const emails = selectedRows.map((u) => u.email).filter(Boolean).join(",");
    if (!emails) return toast.error("Ingen e-poster tilgjengelig");
    window.location.href = `mailto:?bcc=${emails}`;
  };

  const onBulkExport = () => {
    if (selectedRows.length === 0) return;
    const header = "name,email,plan,joined_date\n";
    const body = selectedRows
      .map((u) => {
        const name = (u.display_name ?? "").replace(/"/g, '""');
        const email = (u.email ?? "").replace(/"/g, '""');
        const plan = u.plan ?? "free";
        const joined = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : "";
        return `"${name}","${email}","${plan}","${joined}"`;
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veiglede-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk på navn, brukernavn eller e-post…"
            className="w-full rounded-xl border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <p className="text-xs text-slate-400">{users.length} brukere</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ["all", `Alle (${counts.all})`],
          ["free", `Gratis (${counts.free})`],
          ["pro", `Pro (${counts.pro})`],
          ["gruppe", `Gruppe (${counts.gruppe})`],
          ["admin", `Admin (${counts.admin})`],
          ["inactive", `Deaktivert (${counts.inactive})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs border transition ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-slate-800 text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm">
          <span className="text-slate-200">{selected.size} valgt</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onBulkMail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs hover:bg-slate-800"
            >
              <Mail className="h-3.5 w-3.5" /> Send e-post
            </button>
            <button
              onClick={onBulkExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" /> Eksporter CSV
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              aria-label="Tøm valg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selected.size === users.length}
                  onChange={toggleAll}
                  className="accent-primary"
                />
              </th>
              <th className="text-left px-2 py-3"></th>
              <Th label="Navn" onClick={() => toggleSort("display_name")} active={sortKey === "display_name"} desc={desc} />
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">E-post</th>
              <th className="text-left px-4 py-3">Rolle</th>
              <Th label="Opprettet" onClick={() => toggleSort("created_at")} active={sortKey === "created_at"} desc={desc} />
              <Th label="Turer" onClick={() => toggleSort("tripCount")} active={sortKey === "tripCount"} desc={desc} />
              <th className="text-right px-4 py-3">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Laster…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Ingen brukere</td></tr>
            ) : users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/40 ${u.is_active === false ? "opacity-50" : ""}`}
                onClick={() => setOpenUserId(u.id)}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelected(u.id)}
                    className="accent-primary"
                  />
                </td>
                <td className="px-2 py-3">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold overflow-hidden">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.display_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.display_name ?? "—"}</div>
                  <div className="text-xs text-slate-500">{u.username ? `@${u.username}` : "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <PlanPill plan={u.plan ?? "free"} />
                </td>
                <td className="px-4 py-3 text-slate-400">{u.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-400"}`}>
                    {u.role ?? "user"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("nb-NO") : "—"}</td>
                <td className="px-4 py-3 text-slate-300">{u.tripCount}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex gap-1.5">
                    {u.role === "admin" ? (
                      <button onClick={() => onRole(u.id, "user")} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800">
                        <ShieldOff className="h-3 w-3" /> Fjern admin
                      </button>
                    ) : (
                      <button onClick={() => onRole(u.id, "admin")} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800">
                        <Shield className="h-3 w-3" /> Gjør til admin
                      </button>
                    )}
                    {u.is_active === false ? (
                      <button onClick={() => onActive(u.id, true)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 text-emerald-400 px-2 py-1 text-[11px] hover:bg-emerald-900/20">
                        <UserCheck className="h-3 w-3" /> Aktiver
                      </button>
                    ) : (
                      <button onClick={() => onActive(u.id, false)} className="inline-flex items-center gap-1 rounded-lg border border-red-800 text-red-400 px-2 py-1 text-[11px] hover:bg-red-900/20">
                        <UserX className="h-3 w-3" /> Deaktiver
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserDrawer userId={openUserId} onClose={() => setOpenUserId(null)} />
    </div>
  );
}

/* =========================================================================
   USER DRAWER
   ========================================================================= */

function UserDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const getDetails = useServerFn(adminGetUserDetailsFn);
  const setPlan = useServerFn(adminSetUserPlanFn);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getDetails({ data: { userId: userId! } }),
    enabled: !!userId,
    staleTime: 10_000,
  });

  const [plan, setPlanValue] = useState<"free" | "pro" | "gruppe">("free");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync form with loaded sub
  useEffect(() => {
    if (data?.subscription) {
      setPlanValue((data.subscription.plan as "free" | "pro" | "gruppe") ?? "free");
      setValidUntil(
        data.subscription.current_period_end
          ? new Date(data.subscription.current_period_end).toISOString().slice(0, 10)
          : "",
      );
      setNote("");
    }
  }, [data?.subscription]);

  const onSavePlan = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await setPlan({
        data: {
          userId,
          plan,
          validUntil: validUntil ? new Date(validUntil + "T23:59:59Z").toISOString() : null,
          note: note.trim() || null,
        },
      });
      toast.success("Plan oppdatert");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", userId] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    } finally {
      setSaving(false);
    }
  };

  const p = data?.profile;

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Brukerdetaljer</SheetTitle>
        </SheetHeader>

        {isLoading || !data || !p ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Laster…</div>
        ) : (
          <div className="mt-5 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-semibold overflow-hidden">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{p.display_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {p.username ? `@${p.username}` : "uten brukernavn"}
                  {data.email ? ` · ${data.email}` : ""}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Medlem siden {new Date(p.created_at).toLocaleDateString("nb-NO")}
                </div>
              </div>
              <PlanPill plan={data.subscription.plan} />
            </div>

            {p.username && (
              <Link
                to="/u/$username"
                params={{ username: p.username }}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Offentlig profil <ExternalLink className="h-3 w-3" />
              </Link>
            )}

            {/* Subscription info */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Abonnement</div>
              <div className="text-sm">
                {PLAN_LABEL[data.subscription.plan] ?? data.subscription.plan} · {data.subscription.status}
              </div>
              {data.subscription.current_period_end && (
                <div className="text-xs text-muted-foreground">
                  Fornyes {new Date(data.subscription.current_period_end).toLocaleDateString("nb-NO")}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Turer" value={String(data.stats.tripsCount)} />
              <Stat label="Km planlagt" value={data.stats.totalKm.toLocaleString("nb-NO")} />
              <Stat label="Km kjørt" value={data.stats.drivenKm.toLocaleString("nb-NO")} />
            </div>
            <div className="text-xs text-muted-foreground">
              Sist aktiv:{" "}
              {data.stats.lastActive
                ? new Date(data.stats.lastActive).toLocaleString("nb-NO")
                : "—"}
            </div>

            {/* Vehicles */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Garasje ({data.vehicles.length})
              </div>
              {data.vehicles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen kjøretøy registrert.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.vehicles.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 text-sm">
                      <Car className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{v.name}</span>
                      <span className="text-xs text-muted-foreground">· {v.type} / {v.energy}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Plan override */}
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Endre abonnement</div>

              <label className="block">
                <span className="text-xs text-muted-foreground">Plan</span>
                <select
                  value={plan}
                  onChange={(e) => setPlanValue(e.target.value as typeof plan)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="free">Gratis</option>
                  <option value="pro">Pro</option>
                  <option value="gruppe">Gruppe</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-muted-foreground">Gyldig til (valgfritt)</span>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-muted-foreground">Årsak (intern notat)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="F.eks. Testbruker, Influencer-avtale…"
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              <button
                onClick={onSavePlan}
                disabled={saving}
                className="w-full rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Lagrer…" : "Lagre plan"}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* =========================================================================
   AUDIT TAB
   ========================================================================= */

function AuditTab() {
  const listAudit = useServerFn(adminListAuditLogFn);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => listAudit({ data: { limit: 50 } }),
    staleTime: 10_000,
  });

  const entries = data?.entries ?? [];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {isLoading ? (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">Laster…</div>
      ) : entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">Ingen aktivitet ennå</div>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {entries.map((e) => {
            const verb = ACTION_LABEL[e.action] ?? e.action;
            const target = e.target_username ? `@${e.target_username}` : e.target_name ?? (e.target_user_id ? e.target_user_id.slice(0, 8) : "");
            let extra = "";
            if (e.action === "set_plan" && e.metadata) {
              const to = (e.metadata as { to?: string }).to;
              if (to) extra = ` til ${PLAN_LABEL[to] ?? to}`;
            }
            return (
              <li key={e.id} className="px-4 py-3 text-sm">
                <div className="text-slate-200">
                  <strong className="font-medium">{e.admin_name ?? "Admin"}</strong>{" "}
                  {verb}{" "}
                  <span className="text-primary">{target}</span>
                  {extra}
                  {e.note && <span className="text-slate-400"> ({e.note})</span>}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {new Date(e.created_at).toLocaleString("nb-NO")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* =========================================================================
   primitives
   ========================================================================= */

function Th({ label, onClick, active, desc }: { label: string; onClick: () => void; active: boolean; desc: boolean }) {
  return (
    <th className="text-left px-4 py-3">
      <button onClick={onClick} className={`inline-flex items-center gap-1 ${active ? "text-primary" : "hover:text-slate-300"}`}>
        {label} {active && (desc ? "↓" : "↑")}
      </button>
    </th>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    free: "bg-slate-800 text-slate-300",
    pro: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    gruppe: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  };
  return (
    <span className={`inline-block rounded-md border border-transparent px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[plan] ?? map.free}`}>
      {PLAN_LABEL[plan] ?? plan}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
