"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  user: { username: string; role: "MEMBER" | "ADMIN" };
};

export function Nav({ user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    { href: "/", label: "今日日报" },
    { href: "/history", label: "历史" },
    { href: "/projects", label: "项目" },
    { href: "/templates", label: "模板" },
    { href: "/stats", label: "统计" },
    { href: "/settings", label: "设置" },
  ];

  const adminItems = user.role === "ADMIN"
    ? [
        { href: "/admin/users", label: "用户管理", match: "/admin/users" },
        { href: "/admin/team-reports", label: "团队日报", match: "/admin/team-reports" },
      ]
    : [];

  const allItems = [
    ...items.map((it) => ({ ...it, match: it.href })),
    ...adminItems,
  ];

  function isActive(item: { href: string; match: string }) {
    if (item.href === "/") return pathname === "/";
    return pathname?.startsWith(item.match);
  }

  return (
    <header className="border-b border-border bg-card relative" ref={menuRef}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4 md:gap-6">
        <Link href="/" className="font-semibold shrink-0">
          Pingyun Report
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "px-3 py-1.5 rounded hover:bg-muted",
                isActive({ ...it, match: it.href }) && "bg-muted font-medium"
              )}
            >
              {it.label}
            </Link>
          ))}
          {adminItems.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "px-3 py-1.5 rounded hover:bg-muted",
                isActive(it) && "bg-muted font-medium"
              )}
            >
              {it.label}
            </Link>
          ))}
        </nav>

        {/* Desktop user */}
        <div className="ml-auto hidden md:flex items-center gap-3 text-sm">
          <ThemeToggle />
          <span className="text-muted-foreground">{user.username}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="px-2 py-1 rounded hover:bg-muted"
          >
            退出
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto md:hidden p-2 rounded hover:bg-muted"
          aria-label="Toggle menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="md:hidden absolute inset-x-0 top-[57px] z-50 bg-card border-b border-border shadow-lg">
          <nav className="flex flex-col p-2 gap-0.5">
            {allItems.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "px-4 py-2.5 rounded text-sm hover:bg-muted",
                  isActive(it) && "bg-muted font-medium"
                )}
              >
                {it.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{user.username}</span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-3 py-1.5 rounded hover:bg-muted"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
