"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

type ReportSummary = { id: string; date: string; updatedAt: string };

export function HistoryView() {
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    void loadMonth();
  }, [month]);

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
