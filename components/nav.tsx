"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  user: { username: string; role: "MEMBER" | "ADMIN" };
};

export function Nav({ user }: Props) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "今日日报" },
    { href: "/history", label: "历史" },
    { href: "/projects", label: "项目" },
    { href: "/templates", label: "模板" },
    { href: "/stats", label: "统计" },
    { href: "/settings", label: "设置" },
  ];
  return (
    <header className="border-b border-border bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="font-semibold">
          Pingyun Report
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "px-3 py-1.5 rounded hover:bg-muted",
                pathname === it.href && "bg-muted font-medium"
              )}
            >
              {it.label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <>
              <Link
                href="/admin/users"
                className={cn(
                  "px-3 py-1.5 rounded hover:bg-muted",
                  pathname?.startsWith("/admin/users") && "bg-muted font-medium"
                )}
              >
                用户管理
              </Link>
              <Link
                href="/admin/team-reports"
                className={cn(
                  "px-3 py-1.5 rounded hover:bg-muted",
                  pathname?.startsWith("/admin/team-reports") &&
                    "bg-muted font-medium"
                )}
              >
                团队日报
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user.username}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-2 py-1 rounded hover:bg-muted"
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
