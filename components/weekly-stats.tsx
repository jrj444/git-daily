"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatsContent, type StatsData } from "@/components/stats-content";

export function WeeklyStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    async function load() {
      const endDate = dayjs().format("YYYY-MM-DD");
      const startDate = dayjs().subtract(6, "day").format("YYYY-MM-DD");
      try {
        const res = await fetch(
          `/api/stats/commits?startDate=${startDate}&endDate=${endDate}`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json?.error || `加载失败 (HTTP ${res.status})`);
          return;
        }
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "网络错误");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">本周提交概览</h2>
        <Link
          href="/stats"
          className="text-sm text-primary hover:underline"
        >
          查看完整统计 &gt;
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          加载中…
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          <p>{error}</p>
          <Link href="/settings" className="text-primary hover:underline mt-1 inline-block">
            前往设置
          </Link>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.total === 0 && (
        <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          最近 7 天暂无提交记录
        </div>
      )}

      {/* Data state */}
      {!loading && !error && data && data.total > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="总提交" value={data.total} color="text-foreground" />
            <SummaryCard
              label="需求/功能"
              value={data.breakdown.feat || 0}
              color="text-green-700 dark:text-green-400"
            />
            <SummaryCard
              label="Bug 修复"
              value={data.breakdown.fix || 0}
              color="text-red-700 dark:text-red-400"
            />
            <SummaryCard
              label="重构"
              value={data.breakdown.refactor || 0}
              color="text-blue-700 dark:text-blue-400"
            />
          </div>
          <StatsContent data={data} compact />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-xl font-bold", color)}>{value}</div>
    </div>
  );
}
