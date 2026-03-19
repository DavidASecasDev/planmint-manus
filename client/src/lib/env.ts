/**
 * Runtime environment validation
 * Logs warnings instead of throwing to prevent blank screens
 */

const FALLBACK_SUPABASE_URL = 'https://quilsunfhfqqnibheqzl.supabase.co';
const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aWxzdW5maGZxcW5pYmhlcXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MDk0OTgsImV4cCI6MjA4MDk4NTQ5OH0.dZPc_kv0qlYnGp3EvLhD2sjBAsoeRlSihfedYjDoroQ';

function getEnvVar(key: string, fallback: string): string {
  const value = import.meta.env[key];
  if (value && typeof value === 'string') {
    return value;
  }
  console.warn(`[env] Missing ${key}, using fallback`);
  return fallback;
}

// Re-export for convenience
export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', FALLBACK_SUPABASE_URL);
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY', FALLBACK_SUPABASE_KEY);

// Legacy export for backward compatibility
export const env = {
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_ANON_KEY,
};
