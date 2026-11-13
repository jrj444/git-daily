"use client";

import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Repository = {
  id: string;
  projectId: string | null;
  gitlabProjectId: number;
  nameWithNamespace: string;
  alias: string | null;
  webUrl: string | null;
  defaultBranch: string | null;
  enabled: boolean;
};

type BusinessProject = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  enabled: boolean;
  sortOrder: number;
  repositories: Repository[];
};

export function ProjectsManager() {
  const [projects, setProjects] = useState<BusinessProject[]>([]);
  const [unassignedRepos, setUnassignedRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);

  // Batch selection state
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchToggling, setBatchToggling] = useState(false);

  // Modals & form state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [creatingProj, setCreatingProj] = useState(false);

  // Edit Project Modal
  const [editingProject, setEditingProject] = useState<BusinessProject | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Assign Repos Modal
  const [assigningToProject, setAssigningToProject] = useState<BusinessProject | null>(null);
  const [selectedRepoIdsToAssign, setSelectedRepoIdsToAssign] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Import / Sync State
  const [importInput, setImportInput] = useState("");
  const [importTargetProjectId, setImportTargetProjectId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  // Expanded project cards state
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [projRes, unassignedRes] = await Promise.all([
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/gitlab/projects?unassigned=true").then((r) => r.json()),
      ]);

      const loadedProjects: BusinessProject[] = projRes.projects || [];
      setProjects(loadedProjects);
      setUnassignedRepos(unassignedRes.repositories || []);

      // By default expand projects that have repositories
      setExpandedProjectIds((prev) => {
        const next = new Set(prev);
        if (next.size === 0) {
          loadedProjects.forEach((p) => next.add(p.id));
        }
        return next;
      });
    } catch (err: any) {
      toast.error(`加载项目失败: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function toggleExpand(projId: string) {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projId)) {
        next.delete(projId);
      } else {
        next.add(projId);
      }
      return next;
    });
  }

  // --- Batch Selection Helpers ---
  const q = filter.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (showOnlyEnabled && !p.enabled) return false;
      if (!q) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.description?.toLowerCase().includes(q)) return true;
      return p.repositories.some(
        (r) =>
          (r.alias?.toLowerCase().includes(q) ?? false) ||
          r.nameWithNamespace.toLowerCase().includes(q) ||
          String(r.gitlabProjectId).includes(q)
      );
    });
  }, [projects, showOnlyEnabled, q]);

  const allFilteredSelected = useMemo(
    () =>
      filteredProjects.length > 0 &&
      filteredProjects.every((p) => selectedProjectIds.includes(p.id)),
    [filteredProjects, selectedProjectIds]
  );

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredProjects.map((p) => p.id));
      setSelectedProjectIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const filteredIdSet = new Set(filteredProjects.map((p) => p.id));
      setSelectedProjectIds((prev) => [
        ...prev.filter((id) => !filteredIdSet.has(id)),
        ...filteredProjects.map((p) => p.id),
      ]);
    }
  }

  function toggleSelectProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedReposCount = useMemo(() => {
    const selectedSet = new Set(selectedProjectIds);
    return projects
      .filter((p) => selectedSet.has(p.id))
      .reduce((acc, p) => acc + (p.repositories?.length || 0), 0);
  }, [projects, selectedProjectIds]);

  async function batchDeleteProjects() {
    if (selectedProjectIds.length === 0) return;
    const count = selectedProjectIds.length;
    const msg = `确认批量删除选中的 ${count} 个业务项目？\n\n注意：名下的所有代码仓库将自动释放回【未分配仓库池】，代码仓库数据不会被删除。`;
    if (!confirm(msg)) return;

    setBatchDeleting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedProjectIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "批量删除失败");
        return;
      }
      toast.success(`已批量删除 ${data.count ?? count} 个业务项目`);
      setSelectedProjectIds([]);
      await reload();
    } finally {
      setBatchDeleting(false);
    }
  }

  async function batchToggleProjectsEnabled(enabled: boolean) {
    if (selectedProjectIds.length === 0) return;
    setBatchToggling(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedProjectIds, enabled }),
      });
      if (!res.ok) {
        toast.error("批量更新状态失败");
        return;
      }
      toast.success(enabled ? "已批量启用" : "已批量停用");
      await reload();
    } finally {
      setBatchToggling(false);
    }
  }

  // --- Project Actions ---
  async function toggleProjectEnabled(p: BusinessProject) {
    const next = !p.enabled;
    setProjects((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, enabled: next } : x))
    );
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, enabled: next }),
    });
    if (!res.ok) {
      toast.error("更新项目状态失败");
      void reload();
    }
  }

  async function createProject() {
    const name = newProjName.trim();
    if (!name) {
      toast.error("请填写业务项目名称");
      return;
    }
    setCreatingProj(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newProjDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "创建项目失败");
        return;
      }
      toast.success(`项目「${name}」已创建`);
      setNewProjName("");
      setNewProjDesc("");
      setCreateModalOpen(false);
      await reload();
      if (data.project?.id) {
        setExpandedProjectIds((prev) => new Set(prev).add(data.project.id));
      }
    } finally {
      setCreatingProj(false);
    }
  }

  async function saveProjectEdit() {
    if (!editingProject) return;
    const name = editName.trim();
    if (!name) {
      toast.error("项目名称不能为空");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProject.id,
          name,
          description: editDesc.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error || "更新失败");
        return;
      }
      toast.success("项目信息已更新");
      setEditingProject(null);
      await reload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteProject(p: BusinessProject) {
    const repoCount = p.repositories?.length || 0;
    const msg =
      repoCount > 0
        ? `确认删除业务项目「${p.name}」？\n其名下的 ${repoCount} 个代码仓库将自动释放至【未分配仓库池】，不会丢失。`
        : `确认删除业务项目「${p.name}」？`;

    if (!confirm(msg)) return;

    const res = await fetch(`/api/projects?id=${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error || "删除失败");
      return;
    }
    toast.success("项目已删除");
    setSelectedProjectIds((prev) => prev.filter((id) => id !== p.id));
    await reload();
  }

  // --- Repository Actions ---
  async function toggleRepoEnabled(repo: Repository) {
    const next = !repo.enabled;
    setProjects((prev) =>
      prev.map((proj) => ({
        ...proj,
        repositories: proj.repositories.map((r) =>
          r.id === repo.id ? { ...r, enabled: next } : r
        ),
      }))
    );
    setUnassignedRepos((prev) =>
      prev.map((r) => (r.id === repo.id ? { ...r, enabled: next } : r))
    );

    const res = await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, enabled: next }),
    });
    if (!res.ok) {
      toast.error("更新仓库状态失败");
      void reload();
    }
  }

  async function setRepoAlias(repo: Repository, value: string) {
    const next = value.trim();
    if ((repo.alias || "") === next) return;
    const res = await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, alias: next || null }),
    });
    if (!res.ok) {
      toast.error("别名保存失败");
      void reload();
    } else {
      toast.success("别名已更新");
    }
  }

  async function setRepoBranch(repo: Repository, branch: string) {
    await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, defaultBranch: branch.trim() || null }),
    });
  }

  async function unbindRepoFromProject(repo: Repository, projName: string) {
    if (!confirm(`确认将仓库「${repo.alias || repo.nameWithNamespace}」移出项目「${projName}」？`)) {
      return;
    }
    const res = await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, projectId: null }),
    });
    if (!res.ok) {
      toast.error("移出失败");
      return;
    }
    toast.success("已移至未分配仓库池");
    await reload();
  }

  async function moveRepoToProject(repo: Repository, targetProjectId: string) {
    const res = await fetch("/api/gitlab/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: repo.id, projectId: targetProjectId, enabled: true }),
    });
    if (!res.ok) {
      toast.error("移入项目失败");
      return;
    }
    toast.success("已归入项目");
    await reload();
  }

  async function deleteRepoPermanently(repo: Repository) {
    if (!confirm(`确认从 GitDaily 移除仓库「${repo.nameWithNamespace}」？\n（仅移除缓存，不影响 GitLab）`)) {
      return;
    }
    const res = await fetch(`/api/gitlab/projects?id=${repo.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("删除失败");
      return;
    }
    toast.success("已删除");
    await reload();
  }

  async function assignSelectedRepos() {
    if (!assigningToProject || selectedRepoIdsToAssign.length === 0) return;
    setAssigning(true);
    try {
      const results = await Promise.allSettled(
        selectedRepoIdsToAssign.map((repoId) =>
          fetch("/api/gitlab/projects", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: repoId,
              projectId: assigningToProject.id,
              enabled: true,
            }),
          })
        )
      );
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      toast.success(`已关联 ${okCount} 个仓库至「${assigningToProject.name}」`);
      setAssigningToProject(null);
      setSelectedRepoIdsToAssign([]);
      await reload();
    } finally {
      setAssigning(false);
    }
  }

  async function importSingleRepo() {
    const v = importInput.trim();
    if (!v) {
      toast.error("请填写仓库 ID 或路径");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/gitlab/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idOrPath: v,
          projectId: importTargetProjectId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "导入失败");
        return;
      }
      toast.success(`已导入仓库：${data.project?.nameWithNamespace || v}`);
      setImportInput("");
      setImportTargetProjectId("");
      await reload();
    } finally {
      setImporting(false);
    }
  }

  async function syncAllFromGitlab() {
    setSyncingAll(true);
    try {
      const res = await fetch("/api/gitlab/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshAll: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "同步失败");
        return;
      }
      toast.success(`同步完成：共 ${data.total} 个仓库，新加入 ${data.count} 个`);
      await reload();
    } finally {
      setSyncingAll(false);
    }
  }

  async function cleanUnassignedDisabled() {
    const targets = unassignedRepos.filter((r) => !r.enabled);
    if (targets.length === 0) {
      toast("未分配仓库池中没有未启用的仓库可清理", { icon: "ℹ️" });
      return;
    }
    if (!confirm(`将从 GitDaily 移除未分配池中的 ${targets.length} 个未启用仓库，确认？`)) {
      return;
    }
    const results = await Promise.allSettled(
      targets.map((r) =>
        fetch(`/api/gitlab/projects?id=${r.id}`, { method: "DELETE" })
      )
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`已清理 ${ok} 个仓库`);
    await reload();
  }

  const totalAssignedRepos = useMemo(
    () => projects.reduce((acc, p) => acc + (p.repositories?.length || 0), 0),
    [projects]
  );

  return (
    <div className="space-y-5">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-xl p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">业务项目看板</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {projects.length} 个项目 · {totalAssignedRepos} 个仓库
            </span>
            {unassignedRepos.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {unassignedRepos.length} 个待分配
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            以实际业务为中心管理多个关联代码仓库，日常事项与代码提交天然聚合汇报
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>+</span>
            <span>新建业务项目</span>
          </button>

          <button
            onClick={syncAllFromGitlab}
            disabled={syncingAll}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-border hover:bg-muted transition text-foreground disabled:opacity-60 flex items-center gap-1.5"
            title="从 GitLab 重新同步我有权限的代码仓库"
          >
            <span>🔄</span>
            <span>{syncingAll ? "同步中…" : "同步 GitLab 仓库"}</span>
          </button>
        </div>
      </div>

      {/* Import Quick Bar */}
      <div className="bg-card/70 border border-border rounded-xl p-3.5 text-xs space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            className="flex-1 border border-border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="快速导入单个仓库（输入 GitLab 项目 ID 或路径，如 group/repo）"
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void importSingleRepo();
            }}
          />
          <select
            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={importTargetProjectId}
            onChange={(e) => setImportTargetProjectId(e.target.value)}
          >
            <option value="">放入未分配仓库池</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                归入：{p.name}
              </option>
            ))}
          </select>
          <button
            onClick={importSingleRepo}
            disabled={importing || !importInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium transition disabled:opacity-50"
          >
            {importing ? "导入中…" : "导入"}
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="rounded cursor-pointer"
            />
            全选
          </label>

          <input
            className="w-full sm:w-64 border border-border rounded-lg px-3 py-1.5 text-xs sm:text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="搜索业务项目、仓库名或别名…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />

          <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer whitespace-nowrap select-none">
            <input
              type="checkbox"
              checked={showOnlyEnabled}
              onChange={(e) => setShowOnlyEnabled(e.target.checked)}
              className="rounded"
            />
            仅看已启用
          </label>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>展示 {filteredProjects.length} / {projects.length} 个业务项目</span>
        </div>
      </div>

      {/* Batch Actions Bar (Shown when 1+ projects selected) */}
      {selectedProjectIds.length > 0 && (
        <div className="bg-primary/5 border border-primary/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">
              已选择 {selectedProjectIds.length} 个业务项目
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              （包含约 {selectedReposCount} 个关联代码仓）
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => batchToggleProjectsEnabled(true)}
              disabled={batchToggling}
              className="px-2.5 py-1 text-xs rounded-lg border border-border bg-card hover:bg-muted font-medium transition disabled:opacity-50"
            >
              {batchToggling ? "处理中…" : "批量启用"}
            </button>

            <button
              onClick={() => batchToggleProjectsEnabled(false)}
              disabled={batchToggling}
              className="px-2.5 py-1 text-xs rounded-lg border border-border bg-card hover:bg-muted font-medium transition disabled:opacity-50"
            >
              {batchToggling ? "处理中…" : "批量停用"}
            </button>

            <button
              onClick={batchDeleteProjects}
              disabled={batchDeleting}
              className="px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>🗑️</span>
              <span>{batchDeleting ? "删除中…" : `批量删除 (${selectedProjectIds.length})`}</span>
            </button>

            <button
              onClick={() => setSelectedProjectIds([])}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* Business Projects List */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center bg-card border border-border rounded-xl">
          正在加载业务项目与仓库…
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl space-y-3">
          <div className="text-3xl">📁</div>
          <div className="text-sm font-medium">暂无匹配的业务项目</div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {projects.length === 0
              ? "点击上方「+ 新建业务项目」创建第一个项目，并将代码仓库归入统一管理。"
              : "没有找到符合搜索条件的项目，请调整关键词。"}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredProjects.map((proj) => {
            const isExpanded = expandedProjectIds.has(proj.id);
            const isSelected = selectedProjectIds.includes(proj.id);
            const repos = proj.repositories || [];
            const enabledReposCount = repos.filter((r) => r.enabled).length;

            return (
              <div
                key={proj.id}
                className={cn(
                  "bg-card border rounded-xl shadow-sm transition-all overflow-hidden",
                  isSelected
                    ? "border-primary ring-1 ring-primary/20 bg-primary/[0.015]"
                    : "border-border",
                  !proj.enabled && "opacity-75 bg-muted/20"
                )}
              >
                {/* Project Card Header */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10">
                  <div className="flex items-start sm:items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectProject(proj.id)}
                      className="mt-1 sm:mt-0 rounded cursor-pointer h-4 w-4 text-primary focus:ring-primary"
                      title="勾选此项目以进行批量操作"
                    />

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold text-foreground">
                          {proj.name}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleProjectEnabled(proj)}
                          className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-medium transition cursor-pointer flex items-center gap-1.5 select-none",
                            proj.enabled
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                          title={proj.enabled ? "已启用汇报，点击停用" : "已停用汇报，点击启用"}
                        >
                          <span
                            className={cn(
                              "inline-block w-1.5 h-1.5 rounded-full",
                              proj.enabled ? "bg-emerald-500" : "bg-muted-foreground"
                            )}
                          />
                          <span>{proj.enabled ? "启用中" : "已停用"}</span>
                        </button>

                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            repos.length > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {repos.length} 个仓库
                          {repos.length > 0 && ` (${enabledReposCount} 启用)`}
                        </span>
                      </div>
                      {proj.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {proj.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    <button
                      onClick={() => {
                        setAssigningToProject(proj);
                        setSelectedRepoIdsToAssign([]);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg border border-border hover:bg-muted text-foreground transition font-medium flex items-center gap-1"
                    >
                      <span>+ 关联仓库</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingProject(proj);
                        setEditName(proj.name);
                        setEditDesc(proj.description || "");
                      }}
                      className="px-2 py-1 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition"
                      title="编辑项目信息"
                    >
                      编辑
                    </button>

                    <button
                      onClick={() => deleteProject(proj)}
                      className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/30 transition"
                      title="删除项目"
                    >
                      删除
                    </button>

                    <button
                      onClick={() => toggleExpand(proj.id)}
                      className="p-1 rounded-lg hover:bg-muted text-muted-foreground text-xs"
                      title={isExpanded ? "收起仓库列表" : "展开仓库列表"}
                    >
                      {isExpanded ? "▲ 收起" : "▼ 展开"}
                    </button>
                  </div>
                </div>

                {/* Sub-Repositories Table */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/15 p-3.5 sm:p-4">
                    {repos.length === 0 ? (
                      <div className="text-center py-6 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          该业务项目下暂未关联任何代码仓库
                        </p>
                        <button
                          onClick={() => {
                            setAssigningToProject(proj);
                            setSelectedRepoIdsToAssign([]);
                          }}
                          className="px-3 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition font-medium"
                        >
                          从待分配仓库池关联已有仓库
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-left text-muted-foreground border-b border-border/60">
                            <tr>
                              <th className="py-2 pr-2 w-10">启用</th>
                              <th className="py-2 pr-2">代码仓库</th>
                              <th className="py-2 pr-2 w-48">别名（如: 服务端/门户）</th>
                              <th className="py-2 pr-2 w-32">分支</th>
                              <th className="py-2 pr-2 w-28 text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {repos.map((r) => (
                              <tr key={r.id} className="hover:bg-muted/40 transition">
                                <td className="py-2 pr-2">
                                  <input
                                    type="checkbox"
                                    checked={r.enabled}
                                    onChange={() => toggleRepoEnabled(r)}
                                    className="rounded cursor-pointer"
                                    title={r.enabled ? "停用该仓抓取" : "启用该仓抓取"}
                                  />
                                </td>

                                <td className="py-2 pr-2">
                                  <div className="font-medium text-foreground">
                                    {r.nameWithNamespace}
                                  </div>
                                  {r.webUrl && (
                                    <a
                                      href={r.webUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[11px] text-muted-foreground hover:text-primary hover:underline font-mono"
                                    >
                                      {r.webUrl}
                                    </a>
                                  )}
                                </td>

                                <td className="py-2 pr-2">
                                  <input
                                    className="border border-border rounded px-2 py-1 text-xs w-full bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="可选，如: 服务端/移动端"
                                    defaultValue={r.alias || ""}
                                    maxLength={60}
                                    onBlur={(e) => setRepoAlias(r, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                </td>

                                <td className="py-2 pr-2">
                                  <input
                                    className={cn(
                                      "border border-border rounded px-2 py-1 text-xs w-full bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono",
                                      !r.enabled && "opacity-50"
                                    )}
                                    placeholder="默认"
                                    defaultValue={r.defaultBranch || ""}
                                    onBlur={(e) => setRepoBranch(r, e.target.value)}
                                    disabled={!r.enabled}
                                  />
                                </td>

                                <td className="py-2 pr-2 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => unbindRepoFromProject(r, proj.name)}
                                      className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition"
                                      title="移回未分配仓库池"
                                    >
                                      移出
                                    </button>
                                    <button
                                      onClick={() => deleteRepoPermanently(r)}
                                      className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/30 transition"
                                      title="从系统彻底删除"
                                    >
                                      删除
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned Repositories Pool */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div
          onClick={() => setUnassignedExpanded(!unassignedExpanded)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 select-none"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">📦</span>
            <span className="text-sm font-semibold">未分配仓库池</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {unassignedRepos.length} 个仓库
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              尚未归入任何业务项目的零散仓库
            </span>
          </div>

          <div className="flex items-center gap-2">
            {unassignedExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void cleanUnassignedDisabled();
                }}
                className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                title="清理所有未启用的零散仓库"
              >
                清理未启用仓库
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {unassignedExpanded ? "▲ 收起" : "▼ 展开查看"}
            </span>
          </div>
        </div>

        {unassignedExpanded && (
          <div className="border-t border-border p-4 bg-muted/10 space-y-3">
            {unassignedRepos.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                当前没有未分配的零散仓库。所有仓库均已归入相应业务项目中。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2 pr-2">仓库名称</th>
                      <th className="py-2 pr-2 w-24">GitLab ID</th>
                      <th className="py-2 pr-2 w-32">分支</th>
                      <th className="py-2 pr-2 w-48 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unassignedRepos.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40 transition">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-foreground">
                            {r.alias || r.nameWithNamespace}
                          </div>
                          {r.webUrl && (
                            <a
                              href={r.webUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-primary hover:underline font-mono"
                            >
                              {r.webUrl}
                            </a>
                          )}
                        </td>
                        <td className="py-2 pr-2 font-mono text-muted-foreground">
                          {r.gitlabProjectId}
                        </td>
                        <td className="py-2 pr-2 font-mono text-muted-foreground">
                          {r.defaultBranch || "默认"}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              className="border border-border rounded px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              defaultValue=""
                              onChange={(e) => {
                                const targetId = e.target.value;
                                if (targetId) void moveRepoToProject(r, targetId);
                              }}
                            >
                              <option value="" disabled>
                                + 移入项目…
                              </option>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => deleteRepoPermanently(r)}
                              className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Create Business Project */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold">新建业务项目</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="例如：平云商城 / 用户中台 / 智能监控平台"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  项目描述 / 目标（可选）
                </label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="简述该项目的主要功能、涉及端或业务范围…"
                  rows={3}
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-3.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground"
              >
                取消
              </button>
              <button
                onClick={createProject}
                disabled={creatingProj || !newProjName.trim()}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {creatingProj ? "创建中…" : "立即创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Business Project */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold">编辑业务项目</h3>
              <button
                onClick={() => setEditingProject(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  项目描述 / 目标
                </label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setEditingProject(null)}
                className="px-3.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground"
              >
                取消
              </button>
              <button
                onClick={saveProjectEdit}
                disabled={savingEdit || !editName.trim()}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingEdit ? "保存中…" : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Assign Repositories to Project */}
      {assigningToProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold">
                  关联仓库至「{assigningToProject.name}」
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  从待分配仓库池中选择仓库绑定到此项目
                </p>
              </div>
              <button
                onClick={() => setAssigningToProject(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {unassignedRepos.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  暂无未分配的代码仓库。可通过顶部输入框导入新仓库或同步 GitLab。
                </div>
              ) : (
                unassignedRepos.map((r) => {
                  const isSelected = selectedRepoIdsToAssign.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition select-none",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRepoIdsToAssign((prev) => [...prev, r.id]);
                          } else {
                            setSelectedRepoIdsToAssign((prev) =>
                              prev.filter((id) => id !== r.id)
                            );
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {r.alias || r.nameWithNamespace}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.nameWithNamespace}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                已选 {selectedRepoIdsToAssign.length} 个仓库
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAssigningToProject(null)}
                  className="px-3.5 py-1.5 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground"
                >
                  取消
                </button>
                <button
                  onClick={assignSelectedRepos}
                  disabled={assigning || selectedRepoIdsToAssign.length === 0}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {assigning ? "绑定中…" : `确认关联 (${selectedRepoIdsToAssign.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
