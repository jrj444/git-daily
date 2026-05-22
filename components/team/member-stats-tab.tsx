"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { StatsContent, type StatsData } from "@/components/stats-content";
import {
  MemberFilterBar,
  filterMembers,
  type MemberRole,
  type RoleFilter,
} from "./member-filter";

type Member = {
  id: string;
  username: string;
  displayName: string;
  role: MemberRole;
};

function getMonday(): string {
  const today = dayjs();
  const dayOfWeek = today.day();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return today.subtract(diff, "day").format("YYYY-MM-DD");
}

export function MemberStatsTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getMonday());
  const [endDate, setEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    async function loadMembers() {
      // Reuse team-reports endpoint for today just to get the user list.
      const res = await fetch(
        `/api/admin/team-reports?date=${dayjs().format("YYYY-MM-DD")}`
      );
      const json = await res.json();
      const rows: { user: Member }[] = json.rows || [];
      setMembers(rows.map((r) => r.user));
    }
    void loadMembers();
  }, []);

  async function query(userId: string) {
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      toast.error("结束日期不能早于开始日期");
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(
        `/api/stats/commits?startDate=${startDate}&endDate=${endDate}&userId=${userId}`
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

  function selectMember(id: string) {
    setActiveId(id);
    void query(id);
  }

  const filtered = filterMembers(
    members.map((u) => ({ user: u })),
    search,
    role
  ).map((r) => r.user);

  const activeMember = members.find((m) => m.id === activeId);

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      {/* Member list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <MemberFilterBar
          search={search}
          setSearch={setSearch}
          role={role}
          setRole={setRole}
        />
        <ul className="divide-y divide-border max-h-[400px] md:max-h-[600px] overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-xs text-muted-foreground text-center">
              无匹配成员
            </li>
          )}
          {filtered.map((m) => (
            <li
              key={m.id}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                activeId === m.id ? "bg-primary/10" : "hover:bg-muted"
              }`}
              onClick={() => selectMember(m.id)}
            >
              <span className="flex-1">
                {m.displayName}
                <span className="text-xs text-muted-foreground ml-1">
                  @{m.username}
                </span>
              </span>
              {m.role === "ADMIN" && (
                <span className="text-[10px] text-primary">ADMIN</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Stats area */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3 bg-card border border-border rounded-lg p-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              成员
            </label>
            <div className="text-sm h-[28px] flex items-center">
              {activeMember ? (
                <>
                  <span className="font-medium">{activeMember.displayName}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    @{activeMember.username}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">未选择</span>
              )}
            </div>
          </div>
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
            onClick={() => activeId && query(activeId)}
            disabled={loading || !activeId}
            className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
          >
            {loading ? "查询中…" : "查询"}
          </button>
        </div>

        {!activeId && (
          <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
            从左侧选择成员后查询该成员的提交统计
          </div>
        )}

        {activeId && loading && !data && (
          <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
            查询中…
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="总提交"
                value={data.total}
                color="text-foreground"
              />
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
            {data.total === 0 && (
              <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                该时间范围内没有找到符合条件的提交记录
              </div>
            )}
          </>
        )}
      </div>
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
    <div className="bg-card border border-border rounded-lg p-4 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-2xl font-bold", color)}>{value}</div>
    </div>
  );
}
