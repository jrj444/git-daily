"use client";

import { useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { TYPE_KEYS, TYPE_META } from "@/components/stats-content";
import type { MemberRole } from "./member-filter";

type HeatmapRow = {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: MemberRole;
  };
  submitted: string[];
};

type Heatmap = {
  days: string[];
  rows: HeatmapRow[];
};

type AggregateByUser = {
  user: { id: string; username: string; displayName: string };
  total: number;
  breakdown: Record<string, number>;
};

type Aggregate = {
  total: number;
  breakdown: Record<string, number>;
  byUser: AggregateByUser[];
};

function getMonday(): string {
  const today = dayjs();
  const dayOfWeek = today.day();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return today.subtract(diff, "day").format("YYYY-MM-DD");
}

export function OverviewTab() {
  const [startDate, setStartDate] = useState(getMonday());
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [agg, setAgg] = useState<Aggregate | null>(null);

  async function query() {
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      toast.error("结束日期不能早于开始日期");
      return;
    }
    setLoading(true);
    setHeatmap(null);
    setAgg(null);
    try {
      const qs = `startDate=${startDate}&endDate=${endDate}`;
      const [hr, ar] = await Promise.all([
        fetch(`/api/admin/team-reports/range?${qs}`),
        fetch(`/api/admin/stats/team?${qs}`),
      ]);
      const hj = await hr.json();
      const aj = await ar.json();
      if (!hr.ok) {
        toast.error(hj?.error || "热力图查询失败");
      } else {
        setHeatmap(hj);
      }
      if (!ar.ok) {
        toast.error(aj?.error || "团队统计查询失败");
      } else {
        setAgg(aj);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-card border border-border rounded-lg p-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            开始日期
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            结束日期
          </label>
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
        <div className="text-xs text-muted-foreground ml-auto">
          热力图最多 92 天
        </div>
      </div>

      {!heatmap && !agg && !loading && (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          选择日期范围后点击「查询」，查看团队提交热力图与汇总统计
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Heatmap */}
        {heatmap && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-3">日报提交热力图</h2>
            <SubmissionHeatmap data={heatmap} />
          </div>
        )}

        {/* Aggregate */}
        {agg && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="font-medium">团队类型分布</h2>
                <div className="text-xs text-muted-foreground">
                  总计 {agg.total} 次
                </div>
              </div>
              <div className="space-y-2">
                {TYPE_KEYS.map((key) => {
                  const count = agg.breakdown[key] || 0;
                  if (count === 0 && key !== "feat" && key !== "fix")
                    return null;
                  const pct = agg.total > 0 ? (count / agg.total) * 100 : 0;
                  const meta = TYPE_META[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 text-sm"
                    >
                      <div className={cn("w-20 font-medium", meta.color)}>
                        {meta.label}
                      </div>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div
                          className={cn("h-full rounded", meta.bg)}
                          style={{ width: `${Math.max(pct, 0.5)}%` }}
                        />
                      </div>
                      <div className="w-10 text-right font-mono">{count}</div>
                      <div className="w-14 text-right text-muted-foreground">
                        {pct.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="font-medium mb-2">成员排名</h2>
              {agg.byUser.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  该时间范围内没有任何成员的提交记录
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left py-1 pr-2">成员</th>
                        <th className="text-right py-1 px-2">总数</th>
                        <th className="text-right py-1 px-2">feat</th>
                        <th className="text-right py-1 px-2">fix</th>
                        <th className="text-right py-1 px-2">refactor</th>
                        <th className="text-right py-1 pl-2">other</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.byUser.map((row) => {
                        const otherCount = Object.entries(row.breakdown)
                          .filter(
                            ([k]) =>
                              k !== "feat" && k !== "fix" && k !== "refactor"
                          )
                          .reduce((sum, [, v]) => sum + v, 0);
                        return (
                          <tr
                            key={row.user.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-1.5 pr-2">
                              <span className="font-medium">
                                {row.user.displayName}
                              </span>
                              <span className="text-muted-foreground ml-1">
                                @{row.user.username}
                              </span>
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono font-semibold">
                              {row.total}
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono text-green-700 dark:text-green-400">
                              {row.breakdown.feat || 0}
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono text-red-700 dark:text-red-400">
                              {row.breakdown.fix || 0}
                            </td>
                            <td className="text-right py-1.5 px-2 font-mono text-blue-700 dark:text-blue-400">
                              {row.breakdown.refactor || 0}
                            </td>
                            <td className="text-right py-1.5 pl-2 font-mono text-muted-foreground">
                              {otherCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionHeatmap({ data }: { data: Heatmap }) {
  const { days, rows } = data;
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">没有成员</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left pr-3 py-1 sticky left-0 bg-card z-10">
              成员
            </th>
            {days.map((d) => (
              <th
                key={d}
                title={d}
                className="px-0.5 py-1 text-[10px] font-normal text-muted-foreground"
              >
                {dayjs(d).format("D")}
              </th>
            ))}
            <th className="text-right pl-3 py-1 sticky right-0 bg-card">
              提交
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const set = new Set(row.submitted);
            return (
              <tr key={row.user.id}>
                <td className="pr-3 py-0.5 sticky left-0 bg-card z-10 whitespace-nowrap">
                  <span className="font-medium">{row.user.displayName}</span>
                  {row.user.role === "ADMIN" && (
                    <span className="text-[9px] text-primary ml-1">A</span>
                  )}
                </td>
                {days.map((d) => {
                  const ok = set.has(d);
                  return (
                    <td key={d} className="px-0.5 py-0.5">
                      <div
                        title={`${d} ${ok ? "已提交" : "未提交"}`}
                        className={cn(
                          "w-3.5 h-3.5 rounded-sm",
                          ok ? "bg-primary" : "bg-muted"
                        )}
                      />
                    </td>
                  );
                })}
                <td className="pl-3 py-0.5 text-right text-muted-foreground font-mono sticky right-0 bg-card">
                  {set.size}/{days.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
