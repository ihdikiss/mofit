import {createClient, SupabaseClient} from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://raaompkdkyghhyuxfnen.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_U10SXYvL6TvEBXWQNhsGLQ_CD7WX7B6';

export function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/rest\/v1$/i, '');
}

function readEnvVar(name: string): string | undefined {
  const metaEnv = (
    import.meta as unknown as {env?: Record<string, string | undefined>}
  )?.env;
  const val = metaEnv?.[name];
  return typeof val === 'string' && val.trim().length > 0 ? val : undefined;
}

export const SUPABASE_URL = normalizeSupabaseUrl(
  readEnvVar('VITE_SUPABASE_URL') ?? DEFAULT_SUPABASE_URL,
);

export const SUPABASE_PUBLISHABLE_KEY =
  readEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ??
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}
