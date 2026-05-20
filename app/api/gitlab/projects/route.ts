import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { withErrors, requireUser } from "@/lib/session";
import { getProject, listProjects } from "@/lib/gitlab";

export const GET = withErrors(async () => {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: [{ enabled: "desc" }, { nameWithNamespace: "asc" }],
  });
  return NextResponse.json({ projects });
});

const PatchBody = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  defaultBranch: z.string().optional().nullable(),
  alias: z.string().trim().max(60).optional().nullable(),
});

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PatchBody.parse(await req.json());
  const project = await prisma.project.findFirst({
    where: { id: body.id, userId: user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      enabled: body.enabled ?? project.enabled,
      defaultBranch:
        body.defaultBranch === undefined
          ? project.defaultBranch
          : body.defaultBranch || null,
      alias:
        body.alias === undefined ? project.alias : body.alias || null,
    },
  });
  return NextResponse.json({ project: updated });
});

const PostBody = z.object({
  /** Numeric GitLab project id, or full path like "group/subgroup/repo". */
  idOrPath: z.string().min(1).optional(),
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
  const opts = { baseUrl: u.gitlabBaseUrl, token: decrypt(u.gitlabToken) };

  if (body.refreshAll) {
    try {
      const projects = await listProjects(opts);
      let added = 0;
      for (const p of projects.slice(0, 500)) {
        await prisma.project.upsert({
          where: {
            userId_gitlabProjectId: {
              userId: u.id,
              gitlabProjectId: p.id,
            },
          },
          update: {
            nameWithNamespace: p.name_with_namespace,
            webUrl: p.web_url,
            defaultBranch: p.default_branch ?? undefined,
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
        added++;
      }
      return NextResponse.json({ ok: true, count: added });
    } catch (e: any) {
      return NextResponse.json(
        { error: `刷新失败：${e?.message || e}` },
        { status: 502 }
      );
    }
  }

  if (!body.idOrPath) {
    return NextResponse.json(
      { error: "请提供项目 ID 或路径" },
      { status: 400 }
    );
  }

  let p;
  try {
    p = await getProject(opts, body.idOrPath.trim());
  } catch (e: any) {
    return NextResponse.json(
      { error: `未找到项目：${e?.message || e}` },
      { status: 404 }
    );
  }

  const project = await prisma.project.upsert({
    where: {
      userId_gitlabProjectId: {
        userId: u.id,
        gitlabProjectId: p.id,
      },
    },
    update: {
      nameWithNamespace: p.name_with_namespace,
      webUrl: p.web_url,
      defaultBranch: p.default_branch ?? undefined,
      enabled: true,
    },
    create: {
      userId: u.id,
      gitlabProjectId: p.id,
      nameWithNamespace: p.name_with_namespace,
      webUrl: p.web_url,
      defaultBranch: p.default_branch ?? undefined,
      enabled: true,
    },
  });
  return NextResponse.json({ project });
});

export const DELETE = withErrors(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.project.delete({ where: { id: project.id } });
  return NextResponse.json({ ok: true });
});
