import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 * Created inside this function (not at module top-level) so importing the
 * module during `next build` prerender does not throw when env vars are
 * temporarily unavailable.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createBrowserClient(url, anonKey);
}
