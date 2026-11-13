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

export type RepositoryCommits = {
  repoId?: string;
  repoName: string;
  repoAlias?: string | null;
  webUrl?: string;
  commits: CleanCommit[];
};

export type BusinessProjectGroup = {
  projectId?: string;
  projectName: string;
  description?: string | null;
  repositories: RepositoryCommits[];
  projectNotes: string[];
};

export type ReportContext = {
  date: string;
  projects: ProjectGroup[];
  businessProjects?: BusinessProjectGroup[];
  generalNotes?: string[];
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

export const DEFAULT_PROMPT = `你是一名前端/全栈开发工程师的贴心助手。请根据今日提供的各业务项目（可能包含多个关联代码仓库的提交记录）以及日常工作事项（如会议、文档输出、方案设计、跨组协同等），整理并生成一份专业、规范、简洁的企业工作日报。

输出必须严格遵循以下四段式结构，标题与格式保持一致，禁止添加额外的大标题、一二三四序号或问候语：

今日计划完成工作:
1. <业务项目名/事项> - <高阶概括，如需求开发、架构优化、联调测试、方案设计>

今日实际完成工作:
<业务项目名 / 综合事务>
<按业务项目归纳提炼专业工作要点，整合同一项目下多个子代码仓与日常工作事项，每条不超过35字，纯文本换行展示，不带无意义的提交hash/前缀，条目精炼客观，不要加“- ”或数字编号>

未完成工作及原因:
无

明日工作计划:
1. <业务项目名/事项> - <后续推进任务，如优化迭代、联调测试、方案跟进>

具体要求：
1. 充分整合各业务项目下的代码提交与日常工作项，同一业务项目下的多个代码仓库提交请合并提炼，严禁凭空捏造未提到的项目和工作。
2. 若工作项标记了特定项目（如 [平云商城]），务必归纳至对应业务项目；通用事项（如部门周会、运维巡检）归入“综合事务”。
3. “今日实际完成工作”中：语言精炼专业，每个业务项目或事务下列出具体要点，纯净换行，不要带“- ”或数字编号。
4. “未完成工作及原因”：默认写“无”。
5. 仅输出最终纯文本，禁止附带任何问候语、开场白、代码块反引号（\`\`\`）或解释说明。`;

/**
 * Parses user notes and tags each item to either a matching project name or general notes.
 */
export function parseProjectNotes(
  extraNotes: string | undefined,
  projectNames: string[]
): {
  projectNotesMap: Record<string, string[]>;
  generalNotes: string[];
} {
  const projectNotesMap: Record<string, string[]> = {};
  const generalNotes: string[] = [];

  for (const name of projectNames) {
    projectNotesMap[name] = [];
  }

  if (!extraNotes || !extraNotes.trim()) {
    return { projectNotesMap, generalNotes };
  }

  const lines = extraNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Strip leading dash, bullet, or list number
    const cleanLine = line.replace(/^[-*•\d.]+\s*/, "").trim();
    if (!cleanLine) continue;

    // Check if line starts with [ProjectName] or 【ProjectName】
    const tagMatch = cleanLine.match(/^[\[【]([^\]】]+)[\]】]\s*(.*)$/);
    if (tagMatch) {
      const tag = tagMatch[1].trim();
      const content = tagMatch[2].trim() || cleanLine;

      const matched = projectNames.find(
        (p) =>
          p.toLowerCase() === tag.toLowerCase() ||
          p.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(p.toLowerCase())
      );

      if (matched && projectNotesMap[matched]) {
        projectNotesMap[matched].push(content);
        continue;
      }
    }

    // Check if line mentions any project name directly
    let matchedName: string | null = null;
    for (const name of projectNames) {
      if (cleanLine.includes(name)) {
        matchedName = name;
        break;
      }
    }

    if (matchedName && projectNotesMap[matchedName]) {
      projectNotesMap[matchedName].push(cleanLine);
    } else {
      generalNotes.push(cleanLine);
    }
  }

  return { projectNotesMap, generalNotes };
}

function isBusinessProject(
  p: ProjectGroup | BusinessProjectGroup
): p is BusinessProjectGroup {
  return "repositories" in p && Array.isArray((p as any).repositories);
}

/** Formats project groups, commits and extra non-code notes into clean structured text for LLM consumption. */
export function formatCommitsForPrompt(
  projects: (ProjectGroup | BusinessProjectGroup)[],
  date: string,
  user: { displayName: string },
  extraNotes?: string,
  generalNotes?: string[]
): string {
  const lines: string[] = [
    `日期：${date}`,
    `开发者：${user.displayName}`,
  ];

  if (projects.length > 0) {
    const hasAnyBusiness = projects.some(isBusinessProject);

    if (hasAnyBusiness) {
      lines.push(`\n今日各业务项目工作进展：`);
      for (const item of projects) {
        if (isBusinessProject(item)) {
          lines.push(`\n【项目：${item.projectName}】`);
          const hasCommits = item.repositories.some((r) => r.commits.length > 0);
          if (hasCommits) {
            lines.push(`代码提交记录：`);
            for (const r of item.repositories) {
              const rLabel = r.repoAlias
                ? `${r.repoAlias} (${r.repoName})`
                : r.repoName;
              for (const c of r.commits) {
                const typePrefix = c.type ? `[${c.type}] ` : "";
                lines.push(`- [${rLabel}] ${typePrefix}${c.title}`);
              }
            }
          }
          if (item.projectNotes && item.projectNotes.length > 0) {
            lines.push(`日常非代码事项：`);
            for (const note of item.projectNotes) {
              lines.push(`- ${note}`);
            }
          }
          if (!hasCommits && (!item.projectNotes || item.projectNotes.length === 0)) {
            lines.push(`（今日暂无代码提交与待办项）`);
          }
        } else {
          lines.push(`\n【${item.name}】`);
          for (const c of item.commits) {
            const typePrefix = c.type ? `[${c.type}] ` : "";
            lines.push(`- ${typePrefix}${c.title}`);
          }
        }
      }
    } else {
      lines.push(`\n今日 Git 提交记录：`);
      for (const p of projects as ProjectGroup[]) {
        lines.push(`\n【${p.name}】`);
        for (const c of p.commits) {
          const typePrefix = c.type ? `[${c.type}] ` : "";
          lines.push(`- ${typePrefix}${c.title}`);
        }
      }
    }
  } else {
    lines.push(`\n今日工作记录：（无代码提交）`);
  }

  if (generalNotes && generalNotes.length > 0) {
    lines.push(`\n【综合事务 / 跨项目日常】：`);
    for (const note of generalNotes) {
      lines.push(`- ${note}`);
    }
  } else {
    const cleanNotes = extraNotes?.trim();
    if (cleanNotes) {
      lines.push(`\n今日其他日常工作（会议/文档/项目管理/协同等）：`);
      lines.push(cleanNotes);
    }
  }

  return lines.join("\n");
}

/** Builds the system and user messages for calling LLM based on prompt template and commit context. */
export function buildPromptMessages(
  promptTemplate: string,
  ctx: ReportContext,
  extraNotes?: string
): { role: "system" | "user"; content: string }[] {
  const projectsToFormat =
    ctx.businessProjects && ctx.businessProjects.length > 0
      ? ctx.businessProjects
      : ctx.projects;

  const commitsText = formatCommitsForPrompt(
    projectsToFormat,
    ctx.date,
    ctx.user,
    extraNotes,
    ctx.generalNotes
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
