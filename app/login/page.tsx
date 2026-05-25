"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("用户名或密码错误");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen relative grid place-items-center px-4 overflow-hidden bg-background">
      {/* Decorative gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Branding */}
        <div className="flex flex-col items-center mb-6">
          <img src="/images/logo.png" alt="GitDaily" className="w-20 h-20 mb-3 rounded-xl shadow-lg shadow-primary/20" />
          <h1 className="text-2xl font-semibold tracking-tight">GitDaily</h1>
          <p className="text-sm text-muted-foreground mt-1">
            GitLab 日报生成 | 代码统计
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={onSubmit}
          className="bg-card border border-border rounded-xl p-7 shadow-lg shadow-primary/5 space-y-4"
        >
          <div>
            <h2 className="text-base font-medium">欢迎回来</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              请使用账号登录
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-xs font-medium text-foreground/80"
            >
              用户名
            </label>
            <input
              id="username"
              autoComplete="username"
              className="w-full h-10 bg-background border border-border rounded-md px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground/80"
            >
              密码
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full h-10 bg-background border border-border rounded-md pl-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                title={showPassword ? "隐藏密码" : "显示密码"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          © 2026 ~ Present GitDaily
        </p>
      </div>
    </div>
  );
}
