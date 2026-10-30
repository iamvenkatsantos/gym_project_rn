// CoreFit's Supabase project. Both values are public (the anon key only grants what RLS allows),
// so every run uses the real backend unless it overrides them or opts into the demo.
// api.vinven.net is a Cloudflare Worker (infra/api-proxy) in front of the project, because some
// Indian mobile networks reset connections to *.supabase.co.
const COREFIT_SUPABASE_URL = 'https://api.vinven.net';
const COREFIT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1d3ZoZW5ua2hodG91dGJjYnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MjE4NjMsImV4cCI6MjEwODM5Nzg2M30.ojJY_4A2yhPcs86Tr323UMOBAMdw-oj-7s1WEBywvLU';

/**
 * The demo runs on in-memory mock data and lets you pick a role instead of signing in.
 * Only `npm run demo` and the EAS demo profile turn it on, so store builds never show it.
 */
export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || COREFIT_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || COREFIT_SUPABASE_ANON_KEY,
  // supabase-js names the saved session after the URL's first label. Keep the name from the
  // supabase.co days so moving to api.vinven.net doesn't sign everyone out.
  authStorageKey: 'sb-suwvhennkhhtoutbcbti-auth-token',
};
