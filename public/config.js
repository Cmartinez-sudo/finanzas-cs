// Configuración de Supabase. La "anon key" no es secreta: Supabase la diseña para ir en la página.
// La seguridad está en las reglas (RLS) de supabase.sql, que solo dejan entrar a Carlos y Sofía.
window.SUPABASE_CONFIG = {
  url: 'https://clfmsuhoodhfuspuzrsv.supabase.co', // Project URL, p. ej. https://xxxx.supabase.co
  anonKey: 'sb_publishable_WJzTkzafOfNZZYKPT0dMeA_RG0H7rDA', // anon / public key
};
