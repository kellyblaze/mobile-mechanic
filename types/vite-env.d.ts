interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly DEV?: boolean;
  readonly PROD?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
