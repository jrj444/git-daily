"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const QUICK_TAGS = [
  "需求评审",
  "技术方案",
  "接口文档",
  "跨组协同",
  "线上排障",
  "日常例会",
];

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
  const [extraNotes, setExtraNotes] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
      const savedNotes = (data.report.rawCommits as any)?.extraNotes;
      if (typeof savedNotes === "string") {
        setExtraNotes(savedNotes);
      } else {
        const local =
          typeof window !== "undefined"
            ? localStorage.getItem(`gitdaily_notes_${d}`)
            : null;
        setExtraNotes(local || "");
      }
      setHasSaved(true);
      return true;
    }
    setContent("");
    const local =
      typeof window !== "undefined"
        ? localStorage.getItem(`gitdaily_notes_${d}`)
        : null;
    setExtraNotes(local || "");
    setHasSaved(false);
    return false;
  }, []);

  function handleNotesChange(val: string) {
    setExtraNotes(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(`gitdaily_notes_${date}`, val);
    }
  }

  function insertTag(tag: string) {
    const prefix = `[${tag}] `;
    const next = extraNotes.trim()
      ? `${extraNotes.trimEnd()}\n- ${prefix}`
      : `- ${prefix}`;
    handleNotesChange(next);
  }

  const generate = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          templateId: templateId || undefined,
          projectIds:
            selectedProjects.length &&
            selectedProjects.length !== enabledProjects.length
              ? selectedProjects.join(",")
              : undefined,
          extraNotes: extraNotes.trim() || undefined,
        }),
      });
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
  }, [date, templateId, selectedProjects, enabledProjects.length, extraNotes]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void loadExisting(date);
  }, [date, loadExisting]);

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
          rawCommits: {
            extraNotes: extraNotes.trim(),
          },
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
            <label className="block text-xs text-muted-foreground mb-1">提示词预设</label>
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
            className={cn(
              "px-3 py-1.5 text-sm rounded border flex items-center gap-1.5 disabled:opacity-60",
              !content
                ? "bg-primary text-primary-foreground border-transparent hover:opacity-90 font-medium"
                : "border-border hover:bg-muted"
            )}
          >
            {loading ? "AI 生成中…" : content ? "AI 重新生成" : "AI 生成日报"}
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

      <div className="bg-card border border-border rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium">📝 今日日常事项（非代码工作 / 会议 / 文档 / 协同）</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              白天随手记录，AI 生成时自动融合
            </span>
          </div>
          {extraNotes && (
            <button
              onClick={() => handleNotesChange("")}
              className="text-xs text-muted-foreground hover:text-red-500 transition"
              title="清空日常事项"
            >
              清空
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">快捷添加:</span>
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => insertTag(tag)}
              className="text-xs px-2 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-foreground transition"
            >
              + {tag}
            </button>
          ))}
        </div>

        <textarea
          value={extraNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="在此随手记录今日的会议、方案输出、文档编写、跨部门沟通或运维支持等（一行一条）&#10;点击「AI 生成日报」时，大模型会自动与 Git 提交记录整合归纳…"
          rows={3}
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

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
          textareaProps={{
            placeholder:
              "点击上方「AI 生成日报」按钮，即可由大模型根据今日 Git 提交记录自动生成，或直接在此编写…",
          }}
          preview={typeof window !== "undefined" && window.innerWidth < 768 ? "edit" : "live"}
        />
      </div>
    </div>
  );
}
