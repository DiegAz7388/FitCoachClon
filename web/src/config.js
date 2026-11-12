// Credenciales PÚBLICAS de Arnold V2 (Supabase). Se leen de .env (ver .env.example).
export const config = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
