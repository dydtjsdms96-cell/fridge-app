import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 set이 실패할 수 있음 — proxy가 세션을 갱신합니다.
          }
        },
      },
    },
  );
}

/**
 * Prefer cookie session for Server Components. getUser() can return null
 * (or clear cookies) even when a valid JWT is present, which caused
 * /settings → /login → / bounce loops.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  redirect("/login");
}
