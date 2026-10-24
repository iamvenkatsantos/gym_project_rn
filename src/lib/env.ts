export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Without Supabase the app runs against in-memory mock data. That's allowed in
 * development and in builds that opt in (the EAS preview profile), never in a
 * store build, where reviewers would otherwise see demo content.
 */
export const isDemoMode =
  !isSupabaseConfigured && (__DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true');
