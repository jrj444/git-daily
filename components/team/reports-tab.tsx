"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import {
  MemberFilterBar,
  filterMembers,
  type MemberRole,
  type RoleFilter,
} from "./member-filter";
import { CommentSection } from "@/components/comment-section";
import { LikeButton } from "@/components/like-button";

const MDPreview = dynamic(
  () =>
    import("@uiw/react-md-editor").then((mod) => ({
      default: mod.default.Markdown,
    })),
  { ssr: false }
);

type Row = {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: MemberRole;
  };
  report: {
    id: string;
    content: string;
    updatedAt: string;
  } | null;
};

export function ReportsTab() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { data: session } = useSession();

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const colorMode: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team-reports?date=${date}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || `加载失败 (HTTP ${res.status})`);
        setRows([]);
        return;
      }
      setRows(data.rows || []);
      setActive(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络错误";
      toast.error(`加载失败：${msg}`);
      setRows([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = filterMembers(rows, search, role);
  const submitted = rows.filter((r) => r.report).length;
  const total = rows.length;
  const activeRow = rows.find((r) => r.user.id === active);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
        >
          {loading ? "加载中…" : "刷新"}
        </button>
        <div className="text-sm text-muted-foreground pb-1">
          已提交：<span className="text-primary font-medium">{submitted}</span>
          {" / "}
          {total}
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <MemberFilterBar
            search={search}
            setSearch={setSearch}
            role={role}
            setRole={setRole}
          />
          <ul className="divide-y divide-border max-h-[400px] md:max-h-[600px] overflow-y-auto">
            {loading && (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center">
                加载中…
              </li>
            )}
            {!loading && loaded && rows.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center">
                暂无成员数据
              </li>
            )}
            {!loading && rows.length > 0 && filteredRows.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground text-center">
                无匹配成员
              </li>
            )}
            {filteredRows.map((r) => (
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
              <div className="mt-3 flex items-center gap-2">
                <LikeButton reportId={activeRow.report.id} />
              </div>
              <CommentSection
                reportId={activeRow.report.id}
                currentUserId={session?.user?.id}
                isAdmin={session?.user?.role === "ADMIN"}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
