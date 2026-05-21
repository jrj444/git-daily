"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Three-state theme toggle: light -> dark -> system -> light...
 * Shows sun (light), moon (dark), or laptop (system) icon.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder on SSR / before mount to avoid hydration mismatch
  if (!mounted) {
    return <div className="w-9 h-9" aria-hidden />;
  }

  const current = theme || "system";

  function cycle() {
    if (current === "light") setTheme("dark");
    else if (current === "dark") setTheme("system");
    else setTheme("light");
  }

  const label =
    current === "light"
      ? "切换到深色模式"
      : current === "dark"
      ? "切换到跟随系统"
      : "切换到浅色模式";

  return (
    <button
      onClick={cycle}
      className="p-2 rounded hover:bg-muted text-foreground"
      aria-label={label}
      title={label}
    >
      {current === "system" ? (
        // laptop icon
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <line x1="2" y1="22" x2="22" y2="22" />
        </svg>
      ) : resolvedTheme === "dark" ? (
        // moon icon (dark active)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // sun icon (light active)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
          <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
          <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
          <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
        </svg>
      )}
    </button>
  );
}
