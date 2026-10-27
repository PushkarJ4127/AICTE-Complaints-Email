/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_BREVO_API_KEY?: string;
  readonly VITE_BREVO_SENDER_EMAIL?: string;
  readonly VITE_PORTAL_NAME?: string;
  readonly VITE_SIH_PROBLEM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
