import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Returns a Supabase client that always sends the given seat token as the
 * `x-seat-token` request header. Used by guest players so RLS policies can
 * verify they own a seat in a room.
 *
 * Each call returns a fresh client (lightweight) so we can pass per-action tokens.
 */
export function getRoomClient(seatToken: string | null): SupabaseClient<Database> {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase env vars");
  }
  const headers: Record<string, string> = {};
  if (seatToken) headers["x-seat-token"] = seatToken;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // Reuse the same storage so user sessions still apply for signed-in players.
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "sb-uttt-auth",
    },
    global: { headers },
  });
}
