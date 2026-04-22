/**
 * Helpers for calling our server functions with the right caller identity headers
 * (Supabase JWT for signed-in users, x-seat-token for guests).
 */
import { supabase } from "@/integrations/supabase/client";
import { getSeatToken } from "@/lib/identity";

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const seatToken = getSeatToken();
  if (seatToken) headers["x-seat-token"] = seatToken;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers["authorization"] = `Bearer ${token}`;
  } catch {
    // ignore — guest path still works
  }
  return headers;
}

export async function callWithAuth<T extends (args: { headers?: Record<string, string> } & Record<string, unknown>) => Promise<unknown>>(
  fn: T,
  args: Omit<Parameters<T>[0], "headers">,
): Promise<Awaited<ReturnType<T>>> {
  const headers = await authHeaders();
  return (await fn({ ...(args as object), headers } as Parameters<T>[0])) as Awaited<ReturnType<T>>;
}
