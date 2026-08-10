import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — 세션을 쿠키에 저장해 새로고침/서버에서도 유지됩니다. */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
