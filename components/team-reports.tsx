"use client";

import { useEffect, useState } from "react";
import { ReportsTab } from "./team/reports-tab";
import { MemberStatsTab } from "./team/member-stats-tab";
import { OverviewTab } from "./team/overview-tab";

type TabKey = "reports" | "member-stats" | "overview";

const TABS: { key: TabKey; label: string }[] = [
  { key: "reports", label: "日报" },
  { key: "member-stats", label: "成员统计" },
  { key: "overview", label: "团队总览" },
];

function readTabFromUrl(): TabKey {
  if (typeof window === "undefined") return "reports";
  const v = new URLSearchParams(window.location.search).get("tab");
  if (v === "member-stats" || v === "overview") return v;
  return "reports";
}

export function TeamReports() {
  const [tab, setTab] = useState<TabKey>("reports");

  // Hydrate from URL on mount (client only) to avoid SSR mismatch.
  useEffect(() => {
    setTab(readTabFromUrl());
  }, []);

  function changeTab(next: TabKey) {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border">
        <nav className="flex gap-1" aria-label="Team page tabs">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 transition " +
                  (active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "reports" && <ReportsTab />}
      {tab === "member-stats" && <MemberStatsTab />}
      {tab === "overview" && <OverviewTab />}
    </div>
  );
}
