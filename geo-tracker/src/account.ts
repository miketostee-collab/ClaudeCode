import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, onLocalChange } from './db';
import { getSyncState, sync } from './sync';
import { supabaseRemote } from './remote';

/**
 * Optional Google sign-in and background sync. Without sign-in (or when the build has no
 * Supabase settings) the app works on this device only.
 */

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const syncAvailable = !!(URL_ && KEY);

export interface AccountState {
  /** Signed-in email, or null. */
  email: string | null;
  /** Still checking for a saved sign-in. */
  loading: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;
}

let state: AccountState = { email: null, loading: syncAvailable, syncing: false, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

let clientPromise: Promise<SupabaseClient> | null = null;
function client() {
  // Loaded only when sync is configured, so phone-only use doesn't download it.
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_!, KEY!, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }),
  );
  return clientPromise;
}

/** Where Google sends the user back to: this page, without any query or hash. */
const returnUrl = () => location.origin + location.pathname;

export async function signIn() {
  const c = await client();
  set({ error: null });
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: returnUrl() } });
  if (error) set({ error: error.message });
}

/** Signs out. Data on this device stays; it just stops syncing. */
export async function signOut() {
  const c = await client();
  await c.auth.signOut({ scope: 'local' });
}

export async function syncNow() {
  if (!syncAvailable || !state.email) return;
  if (!navigator.onLine) {
    set({ error: "You're offline. Changes will sync when you're back online." });
    return;
  }
  set({ syncing: true, error: null });
  try {
    await sync(db, supabaseRemote(await client()));
    const s = await getSyncState(db);
    set({ syncing: false, lastSyncedAt: s.lastSyncedAt ?? null });
  } catch (e) {
    set({ syncing: false, error: e instanceof Error ? e.message : String(e) });
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function syncSoon(delay = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Starts listening for sign-in and changes. Call once at startup. */
export async function startAccount() {
  if (!syncAvailable) return;
  const s = await getSyncState(db);
  set({ lastSyncedAt: s.lastSyncedAt ?? null });
  const c = await client();
  c.auth.onAuthStateChange((event, session) => {
    const email = session?.user.email ?? (session ? 'Signed in' : null);
    const was = state.email;
    set({ email, loading: false });
    if (event === 'SIGNED_IN' && location.search.includes('code=')) history.replaceState(null, '', returnUrl());
    if (email && !was) syncSoon(0);
  });
  onLocalChange(() => state.email && syncSoon());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncSoon(0));
  window.addEventListener('online', () => syncSoon(0));
}
