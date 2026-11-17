// Credenciales PÚBLICAS de Supabase. Se leen de .env (ver .env.example).
export const config = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
};

// Enlaces de descarga para la página de bienvenida del paciente (vacíos = "disponible pronto").
export const APP_DOWNLOADS = {
  android: import.meta.env.VITE_ANDROID_URL || '',
  ios: import.meta.env.VITE_IOS_URL || '',
};

export const isConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
