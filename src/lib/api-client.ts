/**
 * Build the caller-identity payload (seatToken + optional Supabase JWT)
 * to attach to every game server function call.
 */
import { supabase } from "@/integrations/supabase/client";
import { getSeatToken } from "@/lib/identity";

export async function getCallerIdentity(): Promise<{
  seatToken: string;
  accessToken?: string;
}> {
  const seatToken = getSeatToken();
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch {
    accessToken = undefined;
  }
  return { seatToken, accessToken };
}
