"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
};

type Snippet = { token: string; desc: string };
type Group = { title: string; items: Snippet[] };

const PLACEHOLDER_GROUPS: Group[] = [
  {
    title: "基本",
    items: [
      { token: "{{date}}", desc: "日报日期，YYYY-MM-DD" },
      { token: "{{total}}", desc: "当日所有项目去重后的提交总数" },
      { token: "{{user.displayName}}", desc: "当前用户显示名" },
      { token: "{{user.email}}", desc: "当前用户邮箱（GitLab 邮箱）" },
    ],
  },
  {
    title: "条件分支",
    items: [
      {
        token: "{{#if projects.length}}\n  ...\n{{else}}\n  （今日无提交记录）\n{{/if}}",
        desc: "当存在项目时渲染主体，否则渲染兜底文案",
      },
    ],
  },
  {
    title: "项目循环（在 {{#each projects}} 内）",
    items: [
      {
        token: "{{#each projects}}\n## {{name}}\n{{/each}}",
        desc: "遍历当日有提交的项目",
      },
      { token: "{{name}}", desc: "项目别名（若设置）或 GitLab 全路径" },
      { token: "{{webUrl}}", desc: "项目主页链接" },
    ],
  },
  {
    title: "提交循环（在 {{#each commits}} 内）",
    items: [
      {
        token: "{{#each commits}}\n- {{title}}\n{{/each}}",
        desc: "遍历该项目当日提交（已去重）",
      },
      { token: "{{title}}", desc: "提交标题（去除 conventional 前缀后的纯文案）" },
      { token: "{{type}}", desc: "feat/fix/chore 等（如非 conventional 则为空）" },
      { token: "{{scope}}", desc: "scope（如 auth、list；可能为空）" },
      { token: "{{short_id}}", desc: "提交短 SHA" },
      { token: "{{authored_date}}", desc: "ISO 时间字符串" },
      { token: "{{web_url}}", desc: "提交在 GitLab 上的链接" },
      { token: "{{author_email}}", desc: "提交作者邮箱" },
      { token: "{{message}}", desc: "完整 commit message" },
    ],
  },
];

const DEFAULT_TEMPLATE_SNIPPET = `# {{date}} 日报

{{#if projects.length}}
{{#each projects}}
## {{name}}
{{#each commits}}
- {{title}}
{{/each}}

{{/each}}
{{else}}
（今日无提交记录）
{{/if}}`;

const NEW_ID = "__new__";

export function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<"reference" | "preview">("reference");
  const [previewContent, setPreviewContent] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function reload(preferId?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      const list: Template[] = data.templates || [];
      setTemplates(list);
      const target =
        (preferId && list.find((t) => t.id === preferId)) ||
        list.find((t) => t.isDefault) ||
        list[0];
      if (target) selectTemplate(target);
      else clearSelection();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function selectTemplate(t: Template) {
    if (dirty && !confirm("当前模板有未保存的修改，确定切换？")) return;
    setSelectedId(t.id);
    setName(t.name);
    setBody(t.body);
    setIsDefault(t.isDefault);
    setDirty(false);
    setPreviewContent("");
    setPreviewError(null);
  }

  function clearSelection() {
    setSelectedId(null);
    setName("");
    setBody("");
    setIsDefault(false);
    setDirty(false);
  }

  function newTemplate() {
    if (dirty && !confirm("当前模板有未保存的修改，确定新建？")) return;
    setSelectedId(NEW_ID);
    setName("新模板");
    setBody(DEFAULT_TEMPLATE_SNIPPET);
    setIsDefault(false);
    setDirty(true);
    setPreviewContent("");
    setPreviewError(null);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("请填写模板名称");
      return;
    }
    if (!body.trim()) {
      toast.error("模板内容不能为空");
      return;
    }
    setSaving(true);
    try {
      const isNew = selectedId === NEW_ID || selectedId === null;
      const res = await fetch("/api/templates", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { name: name.trim(), body, isDefault }
            : { id: selectedId, name: name.trim(), body, isDefault }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "保存失败");
        return;
      }
      toast.success("已保存");
      setDirty(false);
      await reload(data.template?.id || selectedId || undefined);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!selectedId || selectedId === NEW_ID) {
      clearSelection();
      return;
    }
    const t = templates.find((x) => x.id === selectedId);
    if (!t) return;
    if (t.isDefault) {
      toast.error("默认模板不能删除，请先把别的模板设为默认");
      return;
    }
    if (!confirm(`删除『${t.name}』？`)) return;
    const res = await fetch(`/api/templates?id=${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error || "删除失败");
      return;
    }
    toast.success("已删除");
    setDirty(false);
    await reload();
  }

  async function preview() {
    if (!body.trim()) {
      toast.error("模板内容不能为空");
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    setTab("preview");
    try {
      const res = await fetch("/api/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data?.error || "预览失败");
        setPreviewContent("");
        return;
      }
      setPreviewContent(data.content || "");
      if (data.error) setPreviewError(data.error);
    } finally {
      setPreviewing(false);
    }
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setBody((prev) => prev + text);
      setDirty(true);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function copyDefault() {
    try {
      await navigator.clipboard.writeText(DEFAULT_TEMPLATE_SNIPPET);
      toast.success("默认模板已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  const hasSelection = selectedId !== null;

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4">
      <aside className="bg-white border border-border rounded-lg p-3 space-y-2 h-fit">
        <button
          onClick={newTemplate}
          className="w-full px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground"
        >
          + 新建模板
        </button>
        <div className="space-y-1 max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="text-xs text-gray-500 py-2 text-center">加载中…</div>
          ) : templates.length === 0 ? (
            <div className="text-xs text-gray-500 py-2 text-center">暂无模板</div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2",
                  selectedId === t.id ? "bg-muted font-medium" : "hover:bg-muted/60"
                )}
              >
                <span className="flex-1 truncate">{t.name}</span>
                {t.isDefault && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    默认
                  </span>
                )}
              </button>
            ))
          )}
          {selectedId === NEW_ID && (
            <div className="px-2 py-1.5 rounded text-sm bg-muted font-medium flex items-center gap-2">
              <span className="flex-1 truncate">{name || "（未命名）"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                未保存
              </span>
            </div>
          )}
        </div>
      </aside>

      <section className="bg-white border border-border rounded-lg p-4 space-y-3">
        {!hasSelection ? (
          <div className="text-sm text-gray-500 py-12 text-center">
            从上方选择一个模板，或点击「新建模板」开始。
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="flex-1 min-w-[160px] border border-border rounded px-2 py-1.5 text-sm"
                placeholder="模板名称"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                maxLength={50}
              />
              <label className="text-xs text-gray-600 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => {
                    setIsDefault(e.target.checked);
                    setDirty(true);
                  }}
                />
                设为默认
              </label>
              <button
                onClick={preview}
                disabled={previewing}
                className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-60"
              >
                {previewing ? "预览中…" : "预览"}
              </button>
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
              >
                {saving ? "保存中…" : "保存"}
              </button>
              {selectedId !== NEW_ID && (
                <button
                  onClick={del}
                  className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              )}
            </div>

            <textarea
              ref={textareaRef}
              className="w-full min-h-[240px] md:min-h-[420px] border border-border rounded px-3 py-2 text-sm font-mono leading-relaxed"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              placeholder="使用 Handlebars 语法编写模板…"
            />

            <div className="border-t border-border -mx-4 mt-2" />

            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => setTab("reference")}
                className={cn(
                  "px-3 py-1.5 rounded",
                  tab === "reference" ? "bg-muted font-medium" : "hover:bg-muted/60"
                )}
              >
                占位符参考
              </button>
              <button
                onClick={() => setTab("preview")}
                className={cn(
                  "px-3 py-1.5 rounded",
                  tab === "preview" ? "bg-muted font-medium" : "hover:bg-muted/60"
                )}
              >
                预览
              </button>
              {tab === "preview" && (
                <button
                  onClick={preview}
                  disabled={previewing}
                  className="ml-auto text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-60"
                >
                  {previewing ? "渲染中…" : "重新渲染"}
                </button>
              )}
            </div>

            {tab === "reference" ? (
              <div className="space-y-4">
                {PLACEHOLDER_GROUPS.map((g) => (
                  <div key={g.title}>
                    <div className="text-xs font-medium text-gray-700 mb-1">
                      {g.title}
                    </div>
                    <ul className="space-y-1">
                      {g.items.map((it) => (
                        <li
                          key={it.token}
                          className="flex items-start gap-2 text-xs"
                        >
                          <button
                            onClick={() => insertAtCursor(it.token)}
                            className="font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 whitespace-pre overflow-x-auto max-w-[60%]"
                            title="点击插入到光标位置"
                          >
                            {it.token}
                          </button>
                          <span className="flex-1 text-gray-600 pt-0.5">
                            {it.desc}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    内置默认模板
                  </div>
                  <pre className="text-xs font-mono p-2 bg-muted rounded whitespace-pre overflow-x-auto">
                    {DEFAULT_TEMPLATE_SNIPPET}
                  </pre>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => insertAtCursor(DEFAULT_TEMPLATE_SNIPPET)}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                    >
                      插入到光标
                    </button>
                    <button
                      onClick={copyDefault}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                    >
                      复制
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {previewError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                    {previewError}
                  </div>
                )}
                {previewContent ? (
                  <pre className="text-xs font-mono p-3 bg-muted rounded whitespace-pre-wrap break-words min-h-[160px]">
                    {previewContent}
                  </pre>
                ) : (
                  <div className="text-xs text-gray-500 py-6 text-center">
                    点击「预览」按钮使用示例数据渲染当前模板。
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
