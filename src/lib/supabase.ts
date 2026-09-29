import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// During offline development/build these can be blank — every caller that
// touches Supabase must already be behind an isOnline() check (see sync.ts),
// so a missing client should never crash the offline path.
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

export function supabaseConfigured() {
  return supabase !== null;
}
