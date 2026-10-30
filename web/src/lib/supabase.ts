import { createClient } from '@supabase/supabase-js';

import { env } from './env';

// The browser keeps the session in localStorage, so a refresh stays signed in.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: env.authStorageKey,
  },
});

/** Throws the Supabase error if present, otherwise returns the data. */
export function unwrap<T>({ data, error }: { data: T; error: Error | null }): NonNullable<T> {
  if (error) throw error;
  if (data == null) throw new Error('No data returned');
  return data;
}
