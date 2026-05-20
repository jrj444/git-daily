import Handlebars from "handlebars";
import type { GitLabCommit, GitLabProject } from "./gitlab";

export type CleanCommit = {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_email: string;
  authored_date: string;
  web_url: string;
  type?: string;
  scope?: string;
};

export type ProjectGroup = {
  name: string;
  webUrl?: string;
  commits: CleanCommit[];
};

export type ReportContext = {
  date: string;
  projects: ProjectGroup[];
  total: number;
  user: { displayName: string; email?: string };
};

const CONVENTIONAL_RE = /^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/;

export function parseConventional(message: string): {
  type?: string;
  scope?: string;
  subject: string;
} {
  const firstLine = message.split("\n")[0].trim();
  const m = firstLine.match(CONVENTIONAL_RE);
  if (!m) return { subject: firstLine };
  return { type: m[1], scope: m[2], subject: m[3] };
}

export function isMergeCommit(c: GitLabCommit): boolean {
  return Array.isArray(c.parent_ids) && c.parent_ids.length > 1;
}

export type FilterOpts = {
  authorEmail?: string;
  noiseRegex?: string | null;
  dropMerges?: boolean;
};

export function filterCommits(
  commits: GitLabCommit[],
  opts: FilterOpts
): GitLabCommit[] {
  let noise: RegExp | null = null;
  if (opts.noiseRegex) {
    try {
      noise = new RegExp(opts.noiseRegex, "i");
    } catch {
      noise = null;
    }
  }
  return commits.filter((c) => {
    if (opts.dropMerges !== false && isMergeCommit(c)) return false;
    if (
      opts.authorEmail &&
      c.author_email?.toLowerCase() !== opts.authorEmail.toLowerCase()
    ) {
      return false;
    }
    if (noise && noise.test(c.title)) return false;
    return true;
  });
}

/** Deduplicate commits with identical (type, scope, subject). Keeps first occurrence. */
export function dedupe(commits: CleanCommit[]): CleanCommit[] {
  const seen = new Set<string>();
  const out: CleanCommit[] = [];
  for (const c of commits) {
    const key = `${c.type || ""}|${c.scope || ""}|${c.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function toCleanCommits(commits: GitLabCommit[]): CleanCommit[] {
  return commits.map((c) => {
    const parsed = parseConventional(c.message || c.title || "");
    return {
      id: c.id,
      short_id: c.short_id,
      title: parsed.subject || c.title,
      message: c.message,
      author_email: c.author_email,
      authored_date: c.authored_date,
      web_url: c.web_url,
      type: parsed.type,
      scope: parsed.scope,
    };
  });
}

export type GroupedSource = {
  project: Pick<GitLabProject, "name_with_namespace" | "web_url"> | {
    name_with_namespace: string;
    web_url?: string;
  };
  commits: GitLabCommit[];
};

export function buildContext(
  date: string,
  groups: GroupedSource[],
  filterOpts: FilterOpts,
  user: { displayName: string; email?: string }
): ReportContext {
  const projects: ProjectGroup[] = [];
  let total = 0;
  for (const g of groups) {
    const filtered = filterCommits(g.commits, filterOpts);
    if (!filtered.length) continue;
    const clean = dedupe(toCleanCommits(filtered));
    total += clean.length;
    projects.push({
      name: g.project.name_with_namespace,
      webUrl: g.project.web_url,
      commits: clean,
    });
  }
  return { date, projects, total, user };
}

export function renderTemplate(body: string, ctx: ReportContext): string {
  try {
    const tpl = Handlebars.compile(body, { noEscape: true });
    return tpl(ctx);
  } catch (e: any) {
    return `# ${ctx.date} 日报\n\n（模板渲染失败：${e?.message || e}）`;
  }
}

export const DEFAULT_TEMPLATE_BODY = `# {{date}} 日报

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
