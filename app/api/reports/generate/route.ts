import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { resolveGitLabToken } from "@/lib/gitlab-token";
import { withErrors, requireUser } from "@/lib/session";
import { listCommits } from "@/lib/gitlab";
import {
  buildContext,
  buildPromptMessages,
  DEFAULT_PROMPT,
  generateEmptyReport,
  filterCommits,
  dedupe,
  toCleanCommits,
  parseProjectNotes,
  type BusinessProjectGroup,
  type RepositoryCommits,
  type ProjectGroup,
} from "@/lib/report";
import { callLLM } from "@/lib/llm";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateId: z.string().optional(),
  projectIds: z.string().optional(),
  extraNotes: z.string().optional(),
});

async function handleGenerate(req: Request) {
  const session = await requireUser();

  let rawParams: Record<string, any> = {};
  if (req.method === "POST") {
    try {
      rawParams = await req.json();
    } catch {
      rawParams = {};
    }
  } else {
    const url = new URL(req.url);
    url.searchParams.forEach((val, key) => {
      rawParams[key] = val;
    });
  }

  const q = QuerySchema.parse(rawParams);
  const date = q.date;
  const since = dayjs(date).startOf("day").toISOString();
  const until = dayjs(date).add(1, "day").startOf("day").toISOString();

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.gitlabBaseUrl || !user.gitlabToken) {
    return NextResponse.json(
      { error: "请先在『设置』中配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }

  const projectFilter = q.projectIds?.split(",").filter(Boolean);

  // Fetch enabled business projects with their enabled repositories
  const businessProjects = await prisma.project.findMany({
    where: {
      userId: user.id,
      enabled: true,
      ...(projectFilter?.length ? { id: { in: projectFilter } } : {}),
    },
    include: {
      repositories: {
        where: { enabled: true },
        orderBy: [{ defaultBranch: "asc" }, { nameWithNamespace: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Also fetch standalone unassigned repositories that are enabled
  const unassignedRepos = await prisma.repository.findMany({
    where: {
      userId: user.id,
      enabled: true,
      projectId: null,
      ...(projectFilter?.length ? { id: { in: projectFilter } } : {}),
    },
    orderBy: [{ nameWithNamespace: "asc" }],
  });

  const token = await resolveGitLabToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: "请先在『设置』中配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }
  const opts = { baseUrl: user.gitlabBaseUrl!, token };

  // Collect all unique repositories across projects & unassigned pool
  type RepoWithMeta = {
    id: string;
    projectId?: string | null;
    gitlabProjectId: number;
    nameWithNamespace: string;
    alias?: string | null;
    webUrl?: string | null;
    defaultBranch?: string | null;
  };

  const allRepos: RepoWithMeta[] = [];
  const seenRepoIds = new Set<string>();

  for (const bp of businessProjects) {
    for (const r of bp.repositories) {
      if (!seenRepoIds.has(r.id)) {
        seenRepoIds.add(r.id);
        allRepos.push(r);
      }
    }
  }

  for (const r of unassignedRepos) {
    if (!seenRepoIds.has(r.id)) {
      seenRepoIds.add(r.id);
      allRepos.push(r);
    }
  }

  // Fetch commits for each repository in parallel
  const repoResults = await Promise.all(
    allRepos.map(async (r) => {
      try {
        const commits = await listCommits(opts, {
          projectId: r.gitlabProjectId,
          since,
          until,
          branch: r.defaultBranch || undefined,
        });
        return {
          repo: r,
          commits,
          error: null as string | null,
        };
      } catch (e: any) {
        return {
          repo: r,
          commits: [],
          error: e?.message || String(e),
        };
      }
    })
  );

  const filterOpts = {
    authorEmail: user.gitlabEmail || undefined,
    noiseRegex: user.noiseRegex,
    dropMerges: true,
  };

  // Map of repoId -> CleanCommit[]
  const repoCommitsMap = new Map<string, ReturnType<typeof dedupe>>();
  let totalCommits = 0;

  for (const res of repoResults) {
    const filtered = filterCommits(res.commits, filterOpts);
    const clean = dedupe(toCleanCommits(filtered));
    repoCommitsMap.set(res.repo.id, clean);
    totalCommits += clean.length;
  }

  // Parse extraNotes by business project names
  const projectNames = businessProjects.map((bp) => bp.name);
  const { projectNotesMap, generalNotes } = parseProjectNotes(
    q.extraNotes,
    projectNames
  );

  // Build BusinessProjectGroup list
  const businessProjectGroups: BusinessProjectGroup[] = [];
  const legacyProjectGroups: ProjectGroup[] = [];

  for (const bp of businessProjects) {
    const repoGroupList: RepositoryCommits[] = [];
    for (const r of bp.repositories) {
      const cleanCommits = repoCommitsMap.get(r.id) || [];
      if (cleanCommits.length > 0) {
        repoGroupList.push({
          repoId: r.id,
          repoName: r.nameWithNamespace,
          repoAlias: r.alias,
          webUrl: r.webUrl || undefined,
          commits: cleanCommits,
        });

        legacyProjectGroups.push({
          idx: legacyProjectGroups.length + 1,
          name: r.alias ? `${bp.name} - ${r.alias}` : `${bp.name} - ${r.nameWithNamespace}`,
          webUrl: r.webUrl || undefined,
          commits: cleanCommits,
        });
      }
    }

    const notes = projectNotesMap[bp.name] || [];
    // Include this project if it has commits OR notes
    if (repoGroupList.length > 0 || notes.length > 0) {
      businessProjectGroups.push({
        projectId: bp.id,
        projectName: bp.name,
        description: bp.description,
        repositories: repoGroupList,
        projectNotes: notes,
      });
    }
  }

  // Standalone unassigned repositories with commits
  for (const r of unassignedRepos) {
    const cleanCommits = repoCommitsMap.get(r.id) || [];
    if (cleanCommits.length > 0) {
      businessProjectGroups.push({
        projectName: r.alias || r.nameWithNamespace,
        repositories: [
          {
            repoId: r.id,
            repoName: r.nameWithNamespace,
            repoAlias: r.alias,
            webUrl: r.webUrl || undefined,
            commits: cleanCommits,
          },
        ],
        projectNotes: [],
      });

      legacyProjectGroups.push({
        idx: legacyProjectGroups.length + 1,
        name: r.alias || r.nameWithNamespace,
        webUrl: r.webUrl || undefined,
        commits: cleanCommits,
      });
    }
  }

  // Pick prompt template
  let promptBody = DEFAULT_PROMPT;
  let templateId: string | null = null;
  if (q.templateId) {
    const tpl = await prisma.template.findFirst({
      where: { id: q.templateId, userId: user.id },
    });
    if (tpl) {
      promptBody = tpl.body;
      templateId = tpl.id;
    }
  } else {
    const tpl = await prisma.template.findFirst({
      where: { userId: user.id, isDefault: true },
    });
    if (tpl) {
      promptBody = tpl.body;
      templateId = tpl.id;
    }
  }

  const ctx = {
    date,
    projects: legacyProjectGroups,
    businessProjects: businessProjectGroups,
    generalNotes,
    total: totalCommits,
    user: { displayName: user.displayName, email: user.gitlabEmail || undefined },
  };

  let content = "";
  const hasExtraNotes = Boolean(q.extraNotes?.trim());
  if (totalCommits === 0 && !hasExtraNotes) {
    content = generateEmptyReport();
  } else {
    try {
      const messages = buildPromptMessages(promptBody, ctx, q.extraNotes);
      content = await callLLM(messages);
    } catch (e: any) {
      console.error("[generate AI error]", e);
      return NextResponse.json(
        { error: `AI 生成失败: ${e?.message || e}` },
        { status: 502 }
      );
    }
  }

  const errors = repoResults
    .filter((g) => g.error)
    .map((g) => ({
      project: g.repo.alias || g.repo.nameWithNamespace,
      error: g.error!,
    }));

  return NextResponse.json({
    date,
    content,
    templateId,
    context: ctx,
    errors,
  });
}

export const GET = withErrors(handleGenerate);
export const POST = withErrors(handleGenerate);
