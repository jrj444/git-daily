"use client";

import { useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { StatsContent, type StatsData } from "@/components/stats-content";

/* ---------- helpers ---------- */

function getMonday(): string {
  const today = dayjs();
  const dayOfWeek = today.day(); // 0=Sun
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return today.subtract(diff, "day").format("YYYY-MM-DD");
}

/* ---------- component ---------- */

export function StatsView() {
  const [startDate, setStartDate] = useState(getMonday());
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatsData | null>(null);

  async function query() {
    if (!startDate || !endDate) {
      toast.error("请选择起止日期");
      return;
    }
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      toast.error("结束日期不能早于开始日期");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stats/commits?startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || "查询失败");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Date range bar */}
      <div className="flex flex-wrap items-end gap-3 bg-card border border-border rounded-lg p-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={query}
          disabled={loading}
          className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
        >
          {loading ? "查询中…" : "查询"}
        </button>
      </div>

      {!data && !loading && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 grid place-items-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-7 h-7 text-primary"
              aria-hidden
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h3 className="text-base font-medium mb-1">尚未查询数据</h3>
          <p className="text-sm text-muted-foreground">
            选择上方的起止日期后，点击「查询」查看提交类型统计。
          </p>
          <p className="text-xs text-muted-foreground/80 mt-2">
            默认范围为本周周一至今天。
          </p>
        </div>
      )}

      {loading && !data && (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          查询中…
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
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

          <StatsContent data={data} />
        </>
      )}

      {data && data.total === 0 && (
        <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          该时间范围内没有找到符合条件的提交记录
        </div>
      )}
    </div>
  );
}

/* ---------- sub-component ---------- */

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
    <div className="bg-card border border-border rounded-lg p-4 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
    </div>
  );
}
