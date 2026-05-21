"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Template = { id: string; name: string; isDefault: boolean };
type Project = {
  id: string;
  nameWithNamespace: string;
  alias?: string | null;
  enabled: boolean;
  defaultBranch: string | null;
};

export function ReportEditor() {
  const [date, setDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [content, setContent] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [errors, setErrors] = useState<{ project: string; error: string }[]>(
    []
  );
  const [hasSaved, setHasSaved] = useState(false);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const colorMode: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  const enabledProjects = useMemo(
    () => projects.filter((p) => p.enabled),
    [projects]
  );

  const loadConfig = useCallback(async () => {
    const [tplRes, projRes] = await Promise.all([
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/gitlab/projects").then((r) => r.json()),
    ]);
    setTemplates(tplRes.templates || []);
    const def = (tplRes.templates || []).find((t: Template) => t.isDefault);
    if (def) setTemplateId(def.id);
    setProjects(projRes.projects || []);
    setSelectedProjects(
      (projRes.projects || [])
        .filter((p: Project) => p.enabled)
        .map((p: Project) => p.id)
    );
  }, []);

  const loadExisting = useCallback(async (d: string) => {
    const res = await fetch(`/api/reports?date=${d}`);
    const data = await res.json();
    if (data?.report?.content) {
      setContent(data.report.content);
      setHasSaved(true);
      return true;
    }
    setHasSaved(false);
    return false;
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const params = new URLSearchParams({ date });
      if (templateId) params.set("templateId", templateId);
      if (
        selectedProjects.length &&
        selectedProjects.length !== enabledProjects.length
      ) {
        params.set("projectIds", selectedProjects.join(","));
      }
      const res = await fetch(`/api/reports/generate?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "生成失败");
        return;
      }
      setContent(data.content || "");
      setErrors(data.errors || []);
      setHasSaved(false);
    } finally {
      setLoading(false);
    }
  }, [date, templateId, selectedProjects, enabledProjects.length]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    (async () => {
      const existed = await loadExisting(date);
      if (!existed) {
        // Auto-generate only if today has no saved report
        // Defer to ensure config loaded
        setTimeout(() => void generate(), 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          content,
          templateId: templateId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "保存失败");
        return;
      }
      setHasSaved(true);
      toast.success("已保存");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败");
    }
  }

  async function polish() {
    if (!content.trim()) {
      toast.error("内容为空");
      return;
    }
    setPolishing(true);
    try {
      const res = await fetch("/api/ai/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "AI 润色失败");
        return;
      }
      setContent(data.content);
      toast.success("AI 润色完成");
    } finally {
      setPolishing(false);
    }
  }

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <label className="block text-xs text-muted-foreground mb-1">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-border rounded px-2 py-1 text-sm w-full"
            />
          </div>
          <div className="min-w-0 flex-1 sm:flex-none">
            <label className="block text-xs text-muted-foreground mb-1">模板</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="border border-border rounded px-2 py-1 text-sm w-full sm:min-w-[140px]"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? "（默认）" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={generate}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-60"
          >
            {loading ? "生成中…" : "重新生成"}
          </button>
          <button
            onClick={polish}
            disabled={polishing || !content}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-60"
          >
            {polishing ? "润色中…" : "AI 润色"}
          </button>
          <button
            onClick={copy}
            disabled={!content}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-60"
          >
            复制
          </button>
          <button
            onClick={save}
            disabled={saving || !content}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
          >
            {saving ? "保存中…" : hasSaved ? "已保存" : "保存"}
          </button>
        </div>
      </div>

      {enabledProjects.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-2">
            参与生成的项目（共 {enabledProjects.length} 个，
            <a className="text-primary underline" href="/settings">
              在设置中开启更多
            </a>
            ）
          </div>
          <div className="flex flex-wrap gap-2">
            {enabledProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProject(p.id)}
                className={cn(
                  "px-2 py-1 text-xs rounded border",
                  selectedProjects.includes(p.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {p.alias || p.nameWithNamespace}
                {p.defaultBranch ? ` · ${p.defaultBranch}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <div className="font-medium mb-1">部分项目获取失败：</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>
                {e.project}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div data-color-mode={colorMode} className="bg-card rounded-lg overflow-hidden border border-border">
        <MDEditor
          value={content}
          onChange={(v) => setContent(v ?? "")}
          height={420}
          preview="edit"
        />
      </div>
    </div>
  );
}
