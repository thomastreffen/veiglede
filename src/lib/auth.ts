import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

let cache: AuthState = { user: null, session: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;

function notify() { listeners.forEach((l) => l()); }

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  // Initial session
  supabase.auth.getSession().then(({ data }) => {
    cache = { user: data.session?.user ?? null, session: data.session, loading: false };
    notify();
  });
  // Listen to changes
  supabase.auth.onAuthStateChange((_event, session) => {
    cache = { user: session?.user ?? null, session, loading: false };
    notify();
  });
}

export function useAuth(): AuthState {
  init();
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return cache;
}

export function getAuthSnapshot(): AuthState { return cache; }

export async function signOut() {
  await supabase.auth.signOut();
}
