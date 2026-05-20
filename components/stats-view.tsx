"use client";

import { useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

/* ---------- type definitions ---------- */

const TYPE_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  feat: { label: "需求/功能", color: "text-green-700", bg: "bg-green-500" },
  fix: { label: "Bug 修复", color: "text-red-700", bg: "bg-red-500" },
  refactor: { label: "重构", color: "text-blue-700", bg: "bg-blue-500" },
  docs: { label: "文档", color: "text-yellow-700", bg: "bg-yellow-500" },
  style: { label: "样式/格式", color: "text-purple-700", bg: "bg-purple-500" },
  test: { label: "测试", color: "text-cyan-700", bg: "bg-cyan-500" },
  chore: { label: "杂务", color: "text-gray-700", bg: "bg-gray-500" },
  perf: { label: "性能优化", color: "text-orange-700", bg: "bg-orange-500" },
  ci: { label: "CI/CD", color: "text-indigo-700", bg: "bg-indigo-500" },
  build: { label: "构建", color: "text-pink-700", bg: "bg-pink-500" },
  other: { label: "其他", color: "text-slate-700", bg: "bg-slate-400" },
};

const TYPE_KEYS = Object.keys(TYPE_META);

type Breakdown = Record<string, number>;
type ProjectStat = { name: string; total: number; breakdown: Breakdown };
type StatsData = { total: number; breakdown: Breakdown; byProject: ProjectStat[] };

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
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

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
      <div className="flex flex-wrap items-end gap-3 bg-white border border-border rounded-lg p-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">结束日期</label>
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

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="总提交" value={data.total} color="text-gray-900" />
            <SummaryCard
              label="需求/功能"
              value={data.breakdown.feat || 0}
              color="text-green-700"
            />
            <SummaryCard
              label="Bug 修复"
              value={data.breakdown.fix || 0}
              color="text-red-700"
            />
            <SummaryCard
              label="重构"
              value={data.breakdown.refactor || 0}
              color="text-blue-700"
            />
          </div>

          {/* Full breakdown table */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="font-medium mb-3">类型分布</h2>
            <div className="space-y-2">
              {TYPE_KEYS.map((key) => {
                const count = data.breakdown[key] || 0;
                if (count === 0 && key !== "feat" && key !== "fix") return null;
                const pct = data.total > 0 ? (count / data.total) * 100 : 0;
                const meta = TYPE_META[key];
                return (
                  <div key={key} className="flex items-center gap-3 text-sm">
                    <div className={cn("w-20 font-medium", meta.color)}>
                      {meta.label}
                    </div>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className={cn("h-full rounded", meta.bg)}
                        style={{ width: `${Math.max(pct, 0.5)}%` }}
                      />
                    </div>
                    <div className="w-10 text-right font-mono">{count}</div>
                    <div className="w-14 text-right text-gray-500">
                      {pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-project breakdown */}
          {data.byProject.length > 0 && (
            <div className="bg-white border border-border rounded-lg p-4">
              <h2 className="font-medium mb-3">
                项目明细（{data.byProject.length} 个项目）
              </h2>
              <div className="space-y-1">
                {data.byProject.map((proj) => (
                  <div key={proj.name} className="border border-border rounded">
                    <button
                      onClick={() =>
                        setExpandedProject(
                          expandedProject === proj.name ? null : proj.name
                        )
                      }
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="font-medium flex-1 text-left truncate">
                        {proj.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        共 {proj.total} 次提交
                      </span>
                      <span className="text-xs">
                        {expandedProject === proj.name ? "▲" : "▼"}
                      </span>
                    </button>
                    {expandedProject === proj.name && (
                      <div className="px-3 pb-2 space-y-1">
                        {TYPE_KEYS.map((key) => {
                          const count = proj.breakdown[key] || 0;
                          if (count === 0) return null;
                          const pct =
                            proj.total > 0
                              ? (count / proj.total) * 100
                              : 0;
                          const meta = TYPE_META[key];
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-2 text-xs"
                            >
                              <div className={cn("w-16", meta.color)}>
                                {meta.label}
                              </div>
                              <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                                <div
                                  className={cn("h-full rounded", meta.bg)}
                                  style={{
                                    width: `${Math.max(pct, 1)}%`,
                                  }}
                                />
                              </div>
                              <div className="w-8 text-right font-mono">
                                {count}
                              </div>
                              <div className="w-12 text-right text-gray-500">
                                {pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {data && data.total === 0 && (
        <div className="bg-white border border-border rounded-lg p-6 text-center text-sm text-gray-500">
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
    <div className="bg-white border border-border rounded-lg p-4 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
    </div>
  );
}
