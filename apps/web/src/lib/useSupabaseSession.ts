// Tracks the real (non-dev) Supabase Auth session. Kept separate from the dev-role switcher in
// devActors.ts — both remain available side by side (docs/frontend-handoff.md requires the dev
// switcher to stay visibly development-only, not be replaced), and App.tsx decides which one to
// build the ApiAdapter from.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.js';

export type SupabaseAuthState = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export function useSupabaseSession(): SupabaseAuthState {
  const [session, setSession] = useState<Session | null>(null);
  // Starts false (not true) when supabase is null — there is nothing to wait on, so treating an
  // unconfigured environment as "still loading" would leave the UI stuck.
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!supabase) return { error: 'Real sign-in is not configured for this environment.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return { session, isLoading, signIn, signOut };
}
