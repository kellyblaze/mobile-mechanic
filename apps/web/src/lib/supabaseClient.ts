// Real (non-dev) authentication. Sign-in only — self-serve sign-up is deliberately not wired up
// here: verified live by reading packages/database/migrations/007_supabase_auth_sync.sql and
// scripts/managed-auth-smoke.ts that a brand-new Supabase Auth user gets synced into
// public.users but never gets a memberships row, so they'd 403 with "No business membership
// exists for this account" on every request. Codex's own test script works around this only by
// inserting the membership row directly via a service-role DB connection, which the frontend
// has no equivalent of. See docs/change-requests/CR-007.md.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Both missing is a valid local-dev configuration (dev-role switcher only, no .env present) —
// null lets the rest of the app treat "no real auth configured" as a first-class state instead
// of crashing at import time.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
