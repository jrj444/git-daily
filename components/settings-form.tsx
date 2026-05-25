"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Me = {
  id: string;
  username: string;
  displayName: string;
  gitlabBaseUrl: string | null;
  gitlabEmail: string | null;
  noiseRegex: string | null;
  hasToken: boolean;
  tokenMask: string;
};

type Project = {
  id: string;
  nameWithNamespace: string;
  webUrl: string | null;
  defaultBranch: string | null;
  enabled: boolean;
};

export function SettingsForm() {
  const [me, setMe] = useState<Me | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [gitlabEmail, setGitlabEmail] = useState("");
  const [noiseRegex, setNoiseRegex] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  const [savingGl, setSavingGl] = useState(false);
  const [savingMe, setSavingMe] = useState(false);

  async function reload() {
    const [meRes, projRes, tplRes] = await Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/gitlab/projects").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    setMe(meRes.user);
    setBaseUrl(meRes.user?.gitlabBaseUrl || "");
    setGitlabEmail(meRes.user?.gitlabEmail || "");
    setNoiseRegex(meRes.user?.noiseRegex || "");
    setProjects(projRes.projects || []);
    setTemplateCount((tplRes.templates || []).length);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function saveGitlab() {
    if (!baseUrl) {
      toast.error("请填写 GitLab 地址");
      return;
    }
    setSavingGl(true);
    try {
      const res = await fetch("/api/gitlab/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          token: token || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "保存失败");
        return;
      }
      if (data.warning) toast(data.warning, { icon: "⚠️" });
      else toast.success("已连接 GitLab");
      setToken("");
      await reload();
    } finally {
      setSavingGl(false);
    }
  }

  async function saveMe() {
    setSavingMe(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noiseRegex: noiseRegex || null,
          gitlabEmail: gitlabEmail.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error || "保存失败");
        return;
      }
      toast.success("已保存");
      await reload();
    } finally {
      setSavingMe(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">GitLab 连接</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              GitLab 地址（如 https://gitlab.company.com）
            </label>
            <input
              className="w-full border border-border rounded px-2 py-1.5 text-sm"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://gitlab.example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1 text-nowrap">
              Personal Access Token (read_api / read_repository)
              {me?.hasToken && (
                <span className="ml-2 text-muted-foreground/70">
                  当前：{me.tokenMask}
                </span>
              )}
            </label>
            <input
              className="w-full border border-border rounded px-2 py-1.5 text-sm"
              type="password"
              placeholder={me?.hasToken ? "留空表示保持不变" : "glpat-xxxx"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          GitLab 账号邮箱（仅用于识别）：{me?.gitlabEmail || "（未识别，请保存后重试）"}
        </div>
        <div>
          <button
            onClick={saveGitlab}
            disabled={savingGl}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
          >
            {savingGl ? "校验中…" : "保存并校验"}
          </button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">过滤设置</h2>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            我的提交邮箱（用于识别哪些 commit 是我的）
          </label>
          <input
            className="w-full border border-border rounded px-2 py-1.5 text-sm font-mono"
            value={gitlabEmail}
            onChange={(e) => setGitlabEmail(e.target.value)}
            placeholder="you@company.com（留空表示不过滤邮箱，所有人的提交都会计入）"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            默认为 GitLab 账号邮箱。如果你本地 <code className="font-mono">git config user.email</code> 与它不一致，请改成你实际提交使用的邮箱；否则你的 commit 会被过滤掉。
          </p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            提交标题忽略正则（不区分大小写，留空表示不忽略）
          </label>
          <input
            className="w-full border border-border rounded px-2 py-1.5 text-sm font-mono"
            value={noiseRegex}
            onChange={(e) => setNoiseRegex(e.target.value)}
            placeholder="^(Merge|chore:)"
          />
        </div>
        <button
          onClick={saveMe}
          disabled={savingMe}
          className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-60"
        >
          {savingMe ? "保存中…" : "保存"}
        </button>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center">
          <h2 className="font-medium">项目</h2>
          <a
            href="/projects"
            className="ml-auto text-sm text-primary hover:underline"
          >
            前往项目管理 →
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          已启用 {projects.filter((p) => p.enabled).length} / {projects.length} 个项目。项目的添加、删除、启用等管理操作请在项目管理页进行。
        </p>
      </section>

      <section className="bg-card border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center">
          <h2 className="font-medium">模板</h2>
          <a
            href="/templates"
            className="ml-auto text-sm text-primary hover:underline"
          >
            前往模板管理 →
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          共 {templateCount} 个模板。在模板管理页可以编辑日报格式、查看占位符说明并预览效果。
        </p>
      </section>
    </div>
  );
}
