// CoreFit's Supabase project, the same public values the mobile app ships with
// (src/lib/env.ts). The anon key only grants what RLS allows.
const COREFIT_SUPABASE_URL = 'https://api.vinven.net';
const COREFIT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1d3ZoZW5ua2hodG91dGJjYnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MjE4NjMsImV4cCI6MjEwODM5Nzg2M30.ojJY_4A2yhPcs86Tr323UMOBAMdw-oj-7s1WEBywvLU';

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || COREFIT_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || COREFIT_SUPABASE_ANON_KEY,
  // Keeps the session saved under the supabase.co name, so the URL change doesn't sign anyone out.
  authStorageKey: 'sb-suwvhennkhhtoutbcbti-auth-token',
};
