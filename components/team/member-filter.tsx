"use client";

export type MemberRole = "MEMBER" | "ADMIN";
export type RoleFilter = "ALL" | MemberRole;

export function MemberFilterBar({
  search,
  setSearch,
  role,
  setRole,
}: {
  search: string;
  setSearch: (s: string) => void;
  role: RoleFilter;
  setRole: (r: RoleFilter) => void;
}) {
  return (
    <div className="space-y-2 p-2 border-b border-border bg-muted/40">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索成员…"
        className="w-full text-sm border border-border rounded px-2 py-1 bg-background"
      />
      <div className="flex gap-1 text-xs">
        {(["ALL", "MEMBER", "ADMIN"] as RoleFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-2 py-0.5 rounded transition ${
              role === r
                ? "bg-primary text-primary-foreground"
                : "bg-background border border-border hover:bg-muted"
            }`}
          >
            {r === "ALL" ? "全部" : r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function filterMembers<
  T extends {
    user: { displayName: string; username: string; role: MemberRole };
  },
>(list: T[], search: string, role: RoleFilter): T[] {
  const q = search.trim().toLowerCase();
  return list.filter((r) => {
    if (role !== "ALL" && r.user.role !== role) return false;
    if (!q) return true;
    return (
      r.user.displayName.toLowerCase().includes(q) ||
      r.user.username.toLowerCase().includes(q)
    );
  });
}
