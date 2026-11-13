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
  idx?: number;
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

const CONVENTIONAL_RE = /^(\w+)(?:[（(]([^）)]+)[）)])?[：:]\s*(.+)$/;

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
      idx: projects.length + 1,
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

export const DEFAULT_PROMPT = `你是一名前端/全栈开发工程师的贴心助手。请根据今日提供的 Git 提交记录及日常其他工作事项（如会议、文档输出、项目管理、跨组协同等），整理并生成一份专业、规范、简洁的企业工作日报。

输出必须严格遵循以下四段式结构，标题与格式保持一致，禁止添加额外的大标题、一二三四序号或问候语：

今日计划完成工作:
1. <项目名/事项> - <高阶概括，如迭代优化、需求开发、方案设计>

今日实际完成工作:
<项目名 / 综合事务>
<按项目或事务陈列专业工作要点，每条不超过35字，纯文本换行展示，不带无意义的提交hash/前缀，条目精炼客观，不要加“- ”或数字编号>

未完成工作及原因:
无

明日工作计划:
1. <项目名/事项> - <后续推进任务，如优化迭代、联调测试、方案跟进>

具体要求：
1. 充分整合 Git 提交与日常非代码工作事项，严禁凭空捏造未提到的项目和工作。
2. 若补充事项中提及了具体项目（如“党建产品接口文档”），请智能归纳至对应项目的完成项中；若是通用事务（如“日常例会”、“运维排障”），可归入对应项目或“综合事务/日常管理”。
3. “今日实际完成工作”中：语言精炼专业，每个项目或事务下列出具体要点，纯净换行，不要带“- ”或数字编号。
4. “未完成工作及原因”：默认写“无”。
5. 仅输出最终纯文本，禁止附带任何问候语、开场白、代码块反引号（\`\`\`）或解释说明。`;

/** Formats project groups, commits and extra non-code notes into clean structured text for LLM consumption. */
export function formatCommitsForPrompt(
  projects: ProjectGroup[],
  date: string,
  user: { displayName: string },
  extraNotes?: string
): string {
  const lines: string[] = [
    `日期：${date}`,
    `开发者：${user.displayName}`,
  ];

  if (projects.length > 0) {
    lines.push(`\n今日 Git 提交记录：`);
    for (const p of projects) {
      lines.push(`\n【${p.name}】`);
      for (const c of p.commits) {
        const typePrefix = c.type ? `[${c.type}] ` : "";
        lines.push(`- ${typePrefix}${c.title}`);
      }
    }
  } else {
    lines.push(`\n今日 Git 提交记录：（无代码提交）`);
  }

  const cleanNotes = extraNotes?.trim();
  if (cleanNotes) {
    lines.push(`\n今日其他日常工作（会议/文档/项目管理/协同等）：`);
    lines.push(cleanNotes);
  }

  return lines.join("\n");
}

/** Builds the system and user messages for calling LLM based on prompt template and commit context. */
export function buildPromptMessages(
  promptTemplate: string,
  ctx: ReportContext,
  extraNotes?: string
): { role: "system" | "user"; content: string }[] {
  const commitsText = formatCommitsForPrompt(
    ctx.projects,
    ctx.date,
    ctx.user,
    extraNotes
  );

  let template = promptTemplate?.trim() || DEFAULT_PROMPT;
  template = template
    .replace(/\{\{date\}\}/g, ctx.date)
    .replace(/\{\{user\}\}/g, ctx.user.displayName)
    .replace(/\{\{total\}\}/g, String(ctx.total));

  if (template.includes("{{commits}}")) {
    const fullPrompt = template.replace(/\{\{commits\}\}/g, commitsText);
    return [{ role: "user", content: fullPrompt }];
  }

  return [
    { role: "system", content: template },
    {
      role: "user",
      content: `以下是今日的工作提交信息与日常事项，请按要求生成工作日报：\n\n${commitsText}`,
    },
  ];
}

export function generateEmptyReport(): string {
  return `今日计划完成工作:\n1. 迭代优化\n\n今日实际完成工作:\n（今日无提交记录）\n\n未完成工作及原因:\n无\n\n明日工作计划:\n1. 优化迭代`;
}

export const DEFAULT_TEMPLATE_BODY = `今日计划完成工作:
{{#if projects.length}}
{{#each projects}}
{{idx}}. {{name}} - 迭代优化
{{/each}}
{{else}}
1. 迭代优化
{{/if}}

今日实际完成工作:
{{#if projects.length}}
{{#each projects}}
{{name}}
{{#each commits}}
{{title}}
{{/each}}

{{/each}}
{{else}}
（今日无提交记录）

{{/if}}
未完成工作及原因:
无

明日工作计划:
{{#if projects.length}}
{{#each projects}}
{{idx}}. {{name}} - 优化迭代
{{/each}}
{{else}}
1. 优化迭代
{{/if}}`;
