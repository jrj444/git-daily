"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

type Props = {
  user: { username: string; role: "MEMBER" | "ADMIN" };
};

export function Nav({ user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Track window scroll position for capsule frosted glass state
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    { href: "/templates", label: "AI 提示词" },
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
    <header
      ref={menuRef}
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "pt-2 sm:pt-3 pointer-events-none"
          : "w-full border-b border-border bg-card/90 backdrop-blur-md"
      )}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div
          className={cn(
            "transition-all duration-300 flex items-center justify-between w-full",
            scrolled
              ? "pointer-events-auto h-12 px-4 sm:px-6 rounded-full border border-border/80 bg-card/85 dark:bg-card/75 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-black/25"
              : "h-14"
          )}
        >
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
              <img src="/images/logo.png" alt="GitDaily" className="w-6 h-6" />
              <span className="font-bold tracking-tight">GitDaily</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "px-3 py-1 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted",
                    isActive({ ...it, match: it.href }) &&
                      "bg-muted font-medium text-foreground dark:text-white"
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
                    "px-3 py-1 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-muted",
                    isActive(it) &&
                      "bg-muted font-medium text-foreground dark:text-white"
                  )}
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop user */}
          <div className="ml-auto hidden md:flex items-center gap-2.5 text-sm shrink-0">
            <ThemeToggle />
            <NotificationBell />
            <span
              className="text-xs text-muted-foreground pl-1 truncate max-w-[120px]"
              title={user.username}
            >
              {user.username}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-2.5 py-1 text-xs rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              退出
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto md:hidden p-1.5 rounded-full hover:bg-muted text-muted-foreground pointer-events-auto"
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
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="max-w-6xl mx-auto px-4 relative">
          <div
            className={cn(
              "md:hidden pointer-events-auto absolute z-50 bg-card/95 backdrop-blur-md border border-border shadow-xl transition-all",
              scrolled
                ? "left-4 right-4 top-2 rounded-2xl p-2"
                : "left-4 right-4 top-0 border-b p-2"
            )}
          >
            <nav className="flex flex-col p-1 gap-0.5">
              {allItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm transition-colors hover:bg-muted",
                    isActive(it) && "bg-muted font-medium text-foreground"
                  )}
                >
                  {it.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-border px-3 py-2.5 mt-1 flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">{user.username}</span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <NotificationBell />
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="px-2.5 py-1 text-xs rounded-full hover:bg-muted"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
