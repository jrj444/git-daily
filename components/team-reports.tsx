"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import { useTheme } from "next-themes";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });
const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

type Row = {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: "MEMBER" | "ADMIN";
  };
  report: {
    id: string;
    content: string;
    updatedAt: string;
  } | null;
};

export function TeamReports() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const colorMode: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  async function load() {
    const res = await fetch(`/api/admin/team-reports?date=${date}`);
    const data = await res.json();
    setRows(data.rows || []);
    setActive(null);
  }

  useEffect(() => {
    void load();
  }, [date]);

  const submitted = rows.filter((r) => r.report).length;
  const total = rows.length;
  const activeRow = rows.find((r) => r.user.id === active);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          已提交：<span className="text-primary font-medium">{submitted}</span>
          {" / "}
          {total}
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="text-xs px-3 py-2 text-muted-foreground bg-muted">成员</div>
          <ul className="divide-y divide-border max-h-[400px] md:max-h-[600px] overflow-y-auto">
            {rows.map((r) => (
              <li
                key={r.user.id}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                  active === r.user.id ? "bg-primary/10" : "hover:bg-muted"
                }`}
                onClick={() => setActive(r.user.id)}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    r.report ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
                <span className="flex-1">
                  {r.user.displayName}
                  <span className="text-xs text-muted-foreground ml-1">
                    @{r.user.username}
                  </span>
                </span>
                {r.user.role === "ADMIN" && (
                  <span className="text-[10px] text-primary">ADMIN</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          {!activeRow ? (
            <div className="text-sm text-muted-foreground">从左侧选择成员</div>
          ) : !activeRow.report ? (
            <div className="text-sm text-muted-foreground">
              {activeRow.user.displayName} 当日未提交日报
            </div>
          ) : (
            <div data-color-mode={colorMode}>
              <div className="text-xs text-muted-foreground mb-2">
                更新时间：
                {new Date(activeRow.report.updatedAt).toLocaleString()}
              </div>
              <MDPreview source={activeRow.report.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
