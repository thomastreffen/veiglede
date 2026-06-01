import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type SubscriptionPlan = "free" | "pro" | "gruppe";
export type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export type ProFeature =
  | "live_sharing"
  | "pdf_export"
  | "ai_packing"
  | "cost_calculator"
  | "unlimited_trips"
  | "unlimited_vehicles"
  | "gruppe";

export const PRO_FEATURE_LABELS: Record<ProFeature, { title: string; desc: string }> = {
  live_sharing: {
    title: "Live-deling av posisjon",
    desc: "La reisefølget se hvor du er i sanntid mens du kjører.",
  },
  pdf_export: {
    title: "PDF-eksport",
    desc: "Eksporter roadbook og turdetaljer som vakker PDF du kan skrive ut.",
  },
  ai_packing: {
    title: "AI-pakkeliste",
    desc: "La AI foreslå hva du må huske basert på rute, vær og kjøretøy.",
  },
  cost_calculator: {
    title: "Kostnadskalkulator",
    desc: "Detaljert estimat av drivstoff, bom, ferge og overnatting.",
  },
  unlimited_trips: {
    title: "Ubegrenset antall turer",
    desc: "Lag så mange turer du vil — ingen tak.",
  },
  unlimited_vehicles: {
    title: "Ubegrenset garasje",
    desc: "Legg til alle kjøretøyene dine — bil, MC, bobil og mer.",
  },
  gruppe: {
    title: "Gruppe-funksjoner",
    desc: "Del turer og garasje med klubben din.",
  },
};

export const FREE_TRIP_LIMIT = 10;
export const FREE_VEHICLE_LIMIT = 2;

type Cache = {
  uid: string | null;
  sub: Subscription | null;
  listeners: Set<() => void>;
  loaded: boolean;
};

const cache: Cache = { uid: null, sub: null, listeners: new Set(), loaded: false };

function notify() {
  cache.listeners.forEach((l) => l());
}

async function load(uid: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  cache.uid = uid;
  cache.sub = (data as Subscription | null) ?? null;
  cache.loaded = true;
  notify();
}

export function refreshSubscription() {
  if (cache.uid) void load(cache.uid);
}

export function useSubscription() {
  const { user } = useAuth();
  const [, force] = useState(0);

  useEffect(() => {
    const listener = () => force((n) => n + 1);
    cache.listeners.add(listener);
    if (user?.id && user.id !== cache.uid) {
      cache.loaded = false;
      void load(user.id);
    } else if (!user) {
      cache.uid = null;
      cache.sub = null;
      cache.loaded = true;
    }
    return () => {
      cache.listeners.delete(listener);
    };
  }, [user?.id]);

  // Realtime — refresh whenever the row changes
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => void load(user.id),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const sub = cache.sub;
  const plan: SubscriptionPlan = sub?.plan ?? "free";
  const active = sub?.status === "active" || !sub;

  const isPro = active && (plan === "pro" || plan === "gruppe");
  const isGruppe = active && plan === "gruppe";

  return {
    loading: !cache.loaded && !!user,
    subscription: sub,
    plan,
    isPro,
    isGruppe,
    isFree: !isPro,
    canAddTrip: (currentCount: number) => isPro || currentCount < FREE_TRIP_LIMIT,
    canAddVehicle: (currentCount: number) => isPro || currentCount < FREE_VEHICLE_LIMIT,
    canUseFeature: (feature: ProFeature): boolean => {
      if (feature === "gruppe") return isGruppe;
      return isPro;
    },
  };
}

/** Helper for one-off checks outside React. */
export function currentPlan(): SubscriptionPlan {
  return cache.sub?.plan ?? "free";
}
