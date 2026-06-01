import { Sparkles, Users } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscription";

export function PlanBadge({ plan, size = "sm" }: { plan: SubscriptionPlan; size?: "sm" | "md" }) {
  if (plan === "free") return null;
  const small = size === "sm";
  const base = small
    ? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
    : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider";

  if (plan === "gruppe") {
    return (
      <span className={`${base} bg-violet-500/15 text-violet-400 border border-violet-500/30`}>
        <Users className={small ? "h-2.5 w-2.5" : "h-3 w-3"} /> Gruppe
      </span>
    );
  }
  return (
    <span className={`${base} bg-primary/15 text-primary border border-primary/30`}>
      <Sparkles className={small ? "h-2.5 w-2.5" : "h-3 w-3"} /> Pro
    </span>
  );
}
