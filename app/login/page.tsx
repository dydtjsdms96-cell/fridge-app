"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        <p className="text-[11px] font-medium tracking-[0.275px] text-muted-foreground uppercase">
          Fridge App
        </p>
        <h1 className="mt-1 text-[22px] font-bold leading-tight text-foreground">
          로그인
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          이메일과 비밀번호로 냉장고를 열어보세요
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              이메일
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@fridge.app"
              className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-[14px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              비밀번호
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-[14px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-status-urgent-border bg-status-urgent-bg px-3 py-2.5 text-[12px] text-status-urgent">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3.5 text-[14px] font-bold text-primary-foreground shadow-[0_4px_12px_rgba(61,112,88,0.3)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
