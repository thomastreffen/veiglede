import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListUsersFn, adminSetUserRoleFn, adminSetUserActiveFn } from "@/lib/admin.functions";
import { Search, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type SortKey = "created_at" | "display_name" | "tripCount";

function AdminUsers() {
  const list = useServerFn(adminListUsersFn);
  const setRole = useServerFn(adminSetUserRoleFn);
  const setActive = useServerFn(adminSetUserActiveFn);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [desc, setDesc] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => list({ data: { search: search || undefined } }),
    staleTime: 10_000,
  });

  const users = useMemo(() => {
    const rows = data?.users ?? [];
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey] as number | string | null;
      const bv = b[sortKey] as number | string | null;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return desc ? bv - av : av - bv;
      return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    if (search) {
      const s = search.toLowerCase();
      return sorted.filter(
        (u) =>
          u.display_name?.toLowerCase().includes(s) ||
          u.username?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s),
      );
    }
    return sorted;
  }, [data, sortKey, desc, search]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDesc(!desc);
    else { setSortKey(k); setDesc(true); }
  };

  const onRole = async (userId: string, role: "user" | "admin") => {
    try {
      await setRole({ data: { userId, role } });
      toast.success(role === "admin" ? "Gjort til admin" : "Admin fjernet");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  const onActive = async (userId: string, isActive: boolean) => {
    try {
      await setActive({ data: { userId, isActive } });
      toast.success(isActive ? "Konto aktivert" : "Konto deaktivert");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Administrasjon</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Brukere</h1>
        </div>
        <p className="text-xs text-slate-400">{users.length} brukere</p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk på navn, brukernavn eller e-post…"
          className="w-full md:w-96 rounded-xl border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <th className="text-left px-4 py-3"></th>
              <Th label="Navn" onClick={() => toggleSort("display_name")} active={sortKey === "display_name"} desc={desc} />
              <th className="text-left px-4 py-3">Brukernavn</th>
              <th className="text-left px-4 py-3">E-post</th>
              <th className="text-left px-4 py-3">Rolle</th>
              <Th label="Opprettet" onClick={() => toggleSort("created_at")} active={sortKey === "created_at"} desc={desc} />
              <Th label="Turer" onClick={() => toggleSort("tripCount")} active={sortKey === "tripCount"} desc={desc} />
              <th className="text-right px-4 py-3">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Laster…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Ingen brukere</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className={`border-b border-slate-800/60 ${u.is_active === false ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold overflow-hidden">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.display_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{u.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{u.username ? `@${u.username}` : "—"}</td>
                <td className="px-4 py-3 text-slate-400">{u.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-400"}`}>
                    {u.role ?? "user"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("nb-NO") : "—"}</td>
                <td className="px-4 py-3 text-slate-300">{u.tripCount}</td>
                <td className="px-4 py-3 text-right">
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
    </div>
  );
}

function Th({ label, onClick, active, desc }: { label: string; onClick: () => void; active: boolean; desc: boolean }) {
  return (
    <th className="text-left px-4 py-3">
      <button onClick={onClick} className={`inline-flex items-center gap-1 ${active ? "text-primary" : "hover:text-slate-300"}`}>
        {label} {active && (desc ? "↓" : "↑")}
      </button>
    </th>
  );
}
