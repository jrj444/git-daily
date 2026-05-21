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
  feat: { label: "需求/功能", color: "text-green-700 dark:text-green-400", bg: "bg-green-500" },
  fix: { label: "Bug 修复", color: "text-red-700 dark:text-red-400", bg: "bg-red-500" },
  refactor: { label: "重构", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-500" },
  docs: { label: "文档", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-500" },
  style: { label: "样式/格式", color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-500" },
  test: { label: "测试", color: "text-cyan-700 dark:text-cyan-400", bg: "bg-cyan-500" },
  chore: { label: "杂务", color: "text-foreground/70", bg: "bg-gray-500" },
  perf: { label: "性能优化", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500" },
  ci: { label: "CI/CD", color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-500" },
  build: { label: "构建", color: "text-pink-700 dark:text-pink-400", bg: "bg-pink-500" },
  other: { label: "其他", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-400" },
};

const TYPE_KEYS = Object.keys(TYPE_META);

type Breakdown = Record<string, number>;
type CommitItem = {
  short_id: string;
  title: string;
  type: string;
  web_url: string | null;
  authored_date: string;
};
type ProjectStat = {
  name: string;
  total: number;
  breakdown: Breakdown;
  commits: CommitItem[];
};
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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  function toggleProject(name: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

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

          {/* Full breakdown table */}
          <div className="bg-card border border-border rounded-lg p-4">
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

          {/* Per-project breakdown */}
          {data.byProject.length > 0 && (() => {
            const allOpen =
              data.byProject.length > 0 &&
              expandedProjects.size === data.byProject.length;
            return (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">
                  项目明细（{data.byProject.length} 个项目）
                </h2>
                <button
                  onClick={() =>
                    setExpandedProjects(
                      allOpen
                        ? new Set()
                        : new Set(data.byProject.map((p) => p.name))
                    )
                  }
                  className="text-xs text-primary hover:underline"
                >
                  {allOpen ? "全部收起" : "全部展开"}
                </button>
              </div>
              <div className="space-y-1">
                {data.byProject.map((proj) => (
                  <div key={proj.name} className="border border-border rounded">
                    <button
                      onClick={() => toggleProject(proj.name)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="font-medium flex-1 text-left truncate">
                        {proj.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        共 {proj.total} 次提交
                      </span>
                      <span className="text-xs">
                        {expandedProjects.has(proj.name) ? "▲" : "▼"}
                      </span>
                    </button>
                    {expandedProjects.has(proj.name) && (
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
                              <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
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
                              <div className="w-12 text-right text-muted-foreground">
                                {pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                        <div className="mt-3 border-t border-border pt-2">
                          <div className="text-xs text-muted-foreground mb-1.5">
                            提交记录（{proj.commits.length}）
                          </div>
                          <ul className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                            {proj.commits.map((c) => {
                              const meta = TYPE_META[c.type] || TYPE_META.other;
                              return (
                                <li
                                  key={c.short_id}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <span
                                    className={cn(
                                      "shrink-0 w-20 text-center px-1.5 py-0.5 rounded font-medium text-white",
                                      meta.bg
                                    )}
                                  >
                                    {meta.label}
                                  </span>
                                  <span className="flex-1 break-words">
                                    {c.title}
                                  </span>
                                  <span className="hidden sm:inline shrink-0 text-muted-foreground font-mono">
                                    {dayjs(c.authored_date).format(
                                      "MM-DD HH:mm"
                                    )}
                                  </span>
                                  {c.web_url && (
                                    <a
                                      href={c.web_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hidden sm:inline shrink-0 font-mono text-primary hover:underline"
                                    >
                                      {c.short_id.slice(0, 7)}
                                    </a>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
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
