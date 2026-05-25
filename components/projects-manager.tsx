"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  gitlabProjectId: number;
  nameWithNamespace: string;
  alias: string | null;
  webUrl: string | null;
  defaultBranch: string | null;
  enabled: boolean;
};

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/gitlab/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function toggleProject(p: Project) {
    const next = !p.enabled;
    setProjects((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, enabled: next } : x))
    );
    const res = await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, enabled: next }),
    });
    if (!res.ok) {
      toast.error("更新失败");
      void reload();
    }
  }

  async function setBranch(p: Project, branch: string) {
    setProjects((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, defaultBranch: branch } : x))
    );
    await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, defaultBranch: branch || null }),
    });
  }

  async function setAlias(p: Project, value: string) {
    const next = value.trim();
    if ((p.alias || "") === next) return;
    const prevAlias = p.alias;
    setProjects((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, alias: next || null } : x))
    );
    const res = await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, alias: next || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error || "别名保存失败");
      setProjects((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, alias: prevAlias } : x))
      );
    }
  }

  async function deleteProject(p: Project) {
    if (!confirm(`确认删除项目「${p.nameWithNamespace}」？\n（仅从本应用移除，不影响 GitLab）`)) return;
    const res = await fetch(`/api/gitlab/projects?id=${p.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error || "删除失败");
      return;
    }
    toast.success("已删除");
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
  }

  async function batchDeleteDisabled() {
    const targets = projects.filter((p) => !p.enabled);
    if (targets.length === 0) {
      toast("没有未启用的项目可清理", { icon: "ℹ️" });
      return;
    }
    if (!confirm(`将删除 ${targets.length} 个未启用的项目，确认？`)) return;
    const results = await Promise.allSettled(
      targets.map((p) =>
        fetch(`/api/gitlab/projects?id=${p.id}`, { method: "DELETE" })
      )
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`已清理 ${ok} 个项目`);
    void reload();
  }

  async function addProject() {
    const v = addInput.trim();
    if (!v) {
      toast.error("请填写项目 ID 或路径（如 group/repo）");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/gitlab/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idOrPath: v }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "添加失败");
        return;
      }
      toast.success(`已添加：${data.project?.nameWithNamespace || v}`);
      setAddInput("");
      await reload();
    } finally {
      setAdding(false);
    }
  }

  async function refreshProjects() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/gitlab/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshAll: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "刷新失败");
        return;
      }
      toast.success(`已同步 ${data.total} 个项目，新增 ${data.count} 个`);
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = projects.filter((p) => {
    if (showOnlyEnabled && !p.enabled) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (p.alias?.toLowerCase().includes(q) ?? false) ||
      p.nameWithNamespace.toLowerCase().includes(q) ||
      String(p.gitlabProjectId).includes(q)
    );
  });

  const enabledCount = projects.filter((p) => p.enabled).length;

  return (
    <div className="space-y-4">
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">添加项目</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 border border-border rounded px-2 py-1.5 text-sm"
            placeholder="项目 ID 或路径，如 12345 或 group/subgroup/repo"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addProject();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={addProject}
              disabled={adding}
              className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
            >
              {adding ? "添加中…" : "添加项目"}
            </button>
            <button
              onClick={refreshProjects}
              disabled={refreshing}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-60"
              title="重新从 GitLab 拉取你有权限的全部项目"
            >
              {refreshing ? "拉取中…" : "重新拉取"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          提示：GitLab 项目页【Settings → General】顶部可看到 Project ID；或直接填写路径，如{" "}
          <code className="font-mono">frontend/web</code>。
        </p>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <h2 className="font-medium">
            项目列表（{enabledCount}/{projects.length} 已启用）
          </h2>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <input
              type="checkbox"
              checked={showOnlyEnabled}
              onChange={(e) => setShowOnlyEnabled(e.target.checked)}
            />
            仅看已启用
          </label>
          <input
            className="w-full sm:w-auto sm:ml-auto border border-border rounded px-2 py-1 text-sm"
            placeholder="搜索名称或 ID"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            onClick={batchDeleteDisabled}
            className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
            title="删除所有未启用的项目"
          >
            清理未启用
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            {projects.length === 0
              ? "暂无项目。请在上方添加，或先在『设置』中保存 GitLab 连接。"
              : "没有匹配的项目。"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-2 w-10">启用</th>
                  <th className="py-2 pr-2">项目</th>
                  <th className="py-2 pr-2 w-44">别名</th>
                  <th className="py-2 pr-2 w-20">ID</th>
                  <th className="py-2 pr-2 w-36">分支</th>
                  <th className="py-2 pr-2 w-20 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={() => toggleProject(p)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="font-medium">
                        {p.alias || p.nameWithNamespace}
                      </div>
                      {p.alias && (
                        <div className="text-xs text-muted-foreground/80">
                          {p.nameWithNamespace}
                        </div>
                      )}
                      {p.webUrl && (
                        <a
                          className="text-xs text-muted-foreground hover:underline"
                          href={p.webUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.webUrl}
                        </a>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="border border-border rounded px-2 py-1 text-xs w-full"
                        placeholder="可选，覆盖默认名"
                        defaultValue={p.alias || ""}
                        maxLength={60}
                        onBlur={(e) => setAlias(p, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2 text-xs font-mono text-muted-foreground">
                      {p.gitlabProjectId}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className={cn(
                          "border border-border rounded px-2 py-1 text-xs w-full",
                          !p.enabled && "opacity-50"
                        )}
                        placeholder="默认"
                        value={p.defaultBranch || ""}
                        onChange={(e) => setBranch(p, e.target.value)}
                        disabled={!p.enabled}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <button
                        onClick={() => deleteProject(p)}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
