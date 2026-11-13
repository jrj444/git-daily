import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveGitLabToken } from "@/lib/gitlab-token";
import { withErrors, requireUser } from "@/lib/session";
import { getProject, listProjects } from "@/lib/gitlab";

export const GET = withErrors(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const unassigned = searchParams.get("unassigned") === "true";
  const projectId = searchParams.get("projectId");

  const whereClause: any = { userId: user.id };
  if (unassigned) {
    whereClause.projectId = null;
  } else if (projectId) {
    whereClause.projectId = projectId;
  }

  const repositories = await prisma.repository.findMany({
    where: whereClause,
    include: {
      project: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: [{ enabled: "desc" }, { nameWithNamespace: "asc" }],
  });

  // Provide both repositories and projects for backward compatibility
  return NextResponse.json({ repositories, projects: repositories });
});

const PatchBody = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  defaultBranch: z.string().optional().nullable(),
  alias: z.string().trim().max(60).optional().nullable(),
  projectId: z.string().optional().nullable(),
});

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PatchBody.parse(await req.json());
  const repo = await prisma.repository.findFirst({
    where: { id: body.id, userId: user.id },
  });
  if (!repo) {
    return NextResponse.json({ error: "仓库未找到" }, { status: 404 });
  }

  // Validate projectId if specified
  if (body.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: body.projectId, userId: user.id },
    });
    if (!proj) {
      return NextResponse.json({ error: "目标业务项目不存在" }, { status: 400 });
    }
  }

  const updated = await prisma.repository.update({
    where: { id: repo.id },
    data: {
      enabled: body.enabled ?? repo.enabled,
      defaultBranch:
        body.defaultBranch === undefined
          ? repo.defaultBranch
          : body.defaultBranch || null,
      alias: body.alias === undefined ? repo.alias : body.alias || null,
      projectId:
        body.projectId === undefined ? repo.projectId : body.projectId,
    },
    include: {
      project: {
        select: { id: true, name: true, color: true },
      },
    },
  });
  return NextResponse.json({ repository: updated, project: updated });
});

const PostBody = z.object({
  /** Numeric GitLab project id, or full path like "group/subgroup/repo". */
  idOrPath: z.string().min(1).optional(),
  /** Optional business project id to associate with */
  projectId: z.string().optional().nullable(),
  /** When true, re-fetch the full membership project list. */
  refreshAll: z.boolean().optional(),
});

export const POST = withErrors(async (req: Request) => {
  const session = await requireUser();
  const body = PostBody.parse(await req.json());

  const u = await prisma.user.findUnique({ where: { id: session.id } });
  if (!u?.gitlabBaseUrl || !u?.gitlabToken) {
    return NextResponse.json(
      { error: "请先在『设置』中保存 GitLab 地址与 Token" },
      { status: 400 }
    );
  }
  const token = await resolveGitLabToken(u.id);
  if (!token) {
    return NextResponse.json(
      { error: "请先在『设置』中保存 GitLab 地址与 Token" },
      { status: 400 }
    );
  }
  const opts = { baseUrl: u.gitlabBaseUrl!, token };

  if (body.refreshAll) {
    try {
      const glProjects = await listProjects(opts);
      let added = 0;
      for (const p of glProjects.slice(0, 500)) {
        const existing = await prisma.repository.findFirst({
          where: { userId: u.id, gitlabProjectId: p.id },
        });
        await prisma.repository.upsert({
          where: {
            userId_gitlabProjectId: {
              userId: u.id,
              gitlabProjectId: p.id,
            },
          },
          update: {
            nameWithNamespace: p.name_with_namespace,
            webUrl: p.web_url,
          },
          create: {
            userId: u.id,
            gitlabProjectId: p.id,
            nameWithNamespace: p.name_with_namespace,
            webUrl: p.web_url,
            defaultBranch: p.default_branch ?? undefined,
            enabled: false,
          },
        });
        if (!existing) added++;
      }
      return NextResponse.json({ ok: true, count: added, total: glProjects.length });
    } catch (e: any) {
      return NextResponse.json(
        { error: `刷新失败：${e?.message || e}` },
        { status: 502 }
      );
    }
  }

  if (!body.idOrPath) {
    return NextResponse.json(
      { error: "请提供仓库 ID 或路径" },
      { status: 400 }
    );
  }

  // Validate projectId if specified
  if (body.projectId) {
    const proj = await prisma.project.findFirst({
      where: { id: body.projectId, userId: u.id },
    });
    if (!proj) {
      return NextResponse.json({ error: "指定的业务项目不存在" }, { status: 400 });
    }
  }

  let p;
  try {
    p = await getProject(opts, body.idOrPath.trim());
  } catch (e: any) {
    return NextResponse.json(
      { error: `未找到仓库：${e?.message || e}` },
      { status: 404 }
    );
  }

  const existing = await prisma.repository.findFirst({
    where: { userId: u.id, gitlabProjectId: p.id },
  });
  if (existing) {
    // If already exists, optionally bind to project if provided
    if (body.projectId && existing.projectId !== body.projectId) {
      const updated = await prisma.repository.update({
        where: { id: existing.id },
        data: { projectId: body.projectId, enabled: true },
        include: { project: true },
      });
      return NextResponse.json({ repository: updated, project: updated });
    }
    return NextResponse.json(
      { error: `仓库「${existing.alias || existing.nameWithNamespace}」已存在，无需重复添加` },
      { status: 409 }
    );
  }

  const repository = await prisma.repository.create({
    data: {
      userId: u.id,
      projectId: body.projectId || null,
      gitlabProjectId: p.id,
      nameWithNamespace: p.name_with_namespace,
      webUrl: p.web_url,
      defaultBranch: p.default_branch ?? undefined,
      enabled: true,
    },
    include: {
      project: true,
    },
  });
  return NextResponse.json({ repository, project: repository });
});

export const DELETE = withErrors(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  const repo = await prisma.repository.findFirst({
    where: { id, userId: user.id },
  });
  if (!repo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.repository.delete({ where: { id: repo.id } });
  return NextResponse.json({ ok: true });
});
