/// <reference types="vite/client" />
declare const __APP_BUILD__: string;

interface ImportMetaEnv {
  /** Supabase project URL. Sync (and the sign-in button) only appear when both are set at build time. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
