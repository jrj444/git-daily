"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CommentSection } from "@/components/comment-section";
import { LikeButton } from "@/components/like-button";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

type ReportSummary = { id: string; date: string; updatedAt: string };

export function HistoryView() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(dayjs().format("YYYY-MM-DD"));
  const [content, setContent] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: session } = useSession();

  // Export state
  const [showExport, setShowExport] = useState(true);
  const [exportStart, setExportStart] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [exportEnd, setExportEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [exporting, setExporting] = useState(false);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const colorMode: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  const days = useMemo(() => {
    const start = dayjs(month + "-01").startOf("month");
    const end = dayjs(month + "-01").endOf("month");
    const offset = start.day(); // 0 sun .. 6 sat
    const arr: (string | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 0; d < end.date(); d++) {
      arr.push(start.add(d, "day").format("YYYY-MM-DD"));
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [month]);

  const haveSet = useMemo(
    () => new Set(summaries.map((s) => dayjs(s.date).format("YYYY-MM-DD"))),
    [summaries]
  );

  async function loadMonth() {
    const res = await fetch(`/api/reports?month=${month}`);
    const data = await res.json();
    setSummaries(data.reports || []);
  }

  async function loadDay(d: string) {
    setSelectedDate(d);
    setEditing(false);
    const res = await fetch(`/api/reports?date=${d}`);
    const data = await res.json();
    setContent(data?.report?.content || "");
    setReportId(data?.report?.id || null);
  }

  async function save() {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, content }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error || "保存失败");
        return;
      }
      toast.success("已保存");
      setEditing(false);
      void loadMonth();
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  async function handleExport() {
    if (!exportStart || !exportEnd) {
      toast.error("请选择起止日期");
      return;
    }
    if (dayjs(exportEnd).isBefore(dayjs(exportStart))) {
      toast.error("结束日期不能早于开始日期");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(
        `/api/reports/export?startDate=${exportStart}&endDate=${exportEnd}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "导出失败");
        return;
      }
      const reports: { date: string; content: string }[] = data.reports || [];
      if (reports.length === 0) {
        toast.error("该范围内暂无日报");
        return;
      }
      // Build markdown
      const lines = [`# 日报 ${exportStart} ~ ${exportEnd}\n`];
      reports.forEach((r, i) => {
        lines.push(`## ${r.date}\n`);
        lines.push(r.content);
        if (i < reports.length - 1) lines.push("\n---\n");
      });
      const md = lines.join("\n");
      // Trigger download
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `日报_${exportStart}_to_${exportEnd}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${reports.length} 篇日报`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络错误";
      toast.error(`导出失败：${msg}`);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void loadMonth();
  }, [month]);

  // Auto-load today's report on mount
  useEffect(() => {
    if (selectedDate) {
      fetch(`/api/reports?date=${selectedDate}`)
        .then((res) => res.json())
        .then((data) => {
          setContent(data?.report?.content || "");
          setReportId(data?.report?.id || null);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4">
      <div className="space-y-3">
        <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center mb-3">
          <button
            onClick={() =>
              setMonth(dayjs(month + "-01").subtract(1, "month").format("YYYY-MM"))
            }
            className="px-2 py-1 text-sm rounded hover:bg-muted"
          >
            ◀
          </button>
          <div className="flex-1 text-center font-medium">{month}</div>
          <button
            onClick={() =>
              setMonth(dayjs(month + "-01").add(1, "month").format("YYYY-MM"))
            }
            className="px-2 py-1 text-sm rounded hover:bg-muted"
          >
            ▶
          </button>
        </div>
        <div className="grid grid-cols-7 text-xs text-center text-muted-foreground mb-1">
          {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const has = haveSet.has(d);
            const isSelected = d === selectedDate;
            const isToday = d === dayjs().format("YYYY-MM-DD");
            return (
              <button
                key={d}
                onClick={() => loadDay(d)}
                className={cn(
                  "aspect-square text-sm rounded relative",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : has
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "hover:bg-muted",
                  isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                {dayjs(d).date()}
                {has && (
                  <span
                    className={cn(
                      "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-primary"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
        </div>

        {/* Export panel */}
        <div className="bg-card border border-border rounded-lg p-3">
          <button
            onClick={() => setShowExport(!showExport)}
            className="w-full flex items-center justify-between text-sm font-medium"
          >
            <span>导出日报</span>
            <span className="text-xs">{showExport ? "▲" : "▼"}</span>
          </button>
          {showExport && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">开始日期</label>
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">结束日期</label>
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="w-full border border-border rounded px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
              >
                {exporting ? "导出中…" : "导出 Markdown"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        {!selectedDate ? (
          <div className="p-6 text-sm text-muted-foreground">从日历选择一天查看</div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <div className="font-medium">{selectedDate}</div>
              {!haveSet.has(selectedDate) && (
                <span className="text-xs text-muted-foreground">（无记录）</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={copy}
                  disabled={!content}
                  className="px-2 py-1 text-xs rounded border border-border hover:bg-muted disabled:opacity-60"
                >
                  复制
                </button>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                  >
                    编辑
                  </button>
                ) : (
                  <button
                    onClick={save}
                    disabled={saving}
                    className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-60"
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              <div data-color-mode={colorMode}>
                <MDEditor
                  value={content}
                  onChange={(v) => setContent(v ?? "")}
                  height={400}
                  preview="edit"
                />
              </div>
            ) : (
              <div data-color-mode={colorMode} className="p-4">
                <MDPreview source={content || "*暂无内容*"} />
                {reportId && (
                  <div className="mt-3 flex items-center gap-2">
                    <LikeButton reportId={reportId} />
                  </div>
                )}
                {reportId && (
                  <CommentSection
                    reportId={reportId}
                    currentUserId={session?.user?.id}
                    isAdmin={session?.user?.role === "ADMIN"}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
