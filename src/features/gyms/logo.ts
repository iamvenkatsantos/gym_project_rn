import { supabase } from '@/lib/supabase';

export const LOGO_BUCKET = 'gym-logos';

/** The public link to a gym logo. In demo mode the path is the logo's local uri. */
export function gymLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!supabase) return path;
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}
