import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";

export const GET = withErrors(async () => {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    include: {
      repositories: {
        orderBy: [{ enabled: "desc" }, { nameWithNamespace: "asc" }],
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { enabled: "desc" },
      { createdAt: "desc" },
    ],
  });
  return NextResponse.json({ projects });
});

const PostBody = z.object({
  name: z.string().trim().min(1, "项目名称不能为空").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  repositoryIds: z.array(z.string()).optional(),
});

export const POST = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PostBody.parse(await req.json());

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: body.name,
      description: body.description || null,
      color: body.color || null,
      enabled: true,
    },
  });

  // If initial repository IDs were provided, associate them
  if (body.repositoryIds && body.repositoryIds.length > 0) {
    await prisma.repository.updateMany({
      where: {
        id: { in: body.repositoryIds },
        userId: user.id,
      },
      data: {
        projectId: project.id,
        enabled: true,
      },
    });
  }

  const result = await prisma.project.findUnique({
    where: { id: project.id },
    include: { repositories: true },
  });

  return NextResponse.json({ project: result });
});

const PatchBody = z.object({
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PatchBody.parse(await req.json());

  // Batch toggle enabled status
  if (body.ids && body.ids.length > 0 && body.enabled !== undefined) {
    const { count } = await prisma.project.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: { enabled: body.enabled },
    });
    return NextResponse.json({ ok: true, count });
  }

  if (!body.id) {
    return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: { id: body.id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const updated = await prisma.project.update({
    where: { id: existing.id },
    data: {
      name: body.name ?? existing.name,
      description:
        body.description === undefined ? existing.description : body.description,
      color: body.color === undefined ? existing.color : body.color,
      enabled: body.enabled ?? existing.enabled,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    },
    include: {
      repositories: {
        orderBy: [{ enabled: "desc" }, { nameWithNamespace: "asc" }],
      },
    },
  });

  return NextResponse.json({ project: updated });
});

export const DELETE = withErrors(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idsParam = searchParams.get("ids");

  let ids: string[] = [];
  if (idsParam) {
    ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (id) {
    ids = [id];
  } else {
    try {
      const body = await req.json();
      if (Array.isArray(body?.ids)) {
        ids = body.ids.filter((x: any) => typeof x === "string" && x.trim());
      } else if (body?.id && typeof body.id === "string") {
        ids = [body.id.trim()];
      }
    } catch {
      // no json body
    }
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "缺少 id 或 ids 参数" }, { status: 400 });
  }

  // Safely detach all repositories belonging to these projects back to unassigned pool
  await prisma.repository.updateMany({
    where: {
      projectId: { in: ids },
      userId: user.id,
    },
    data: {
      projectId: null,
    },
  });

  // Delete the business projects
  const { count } = await prisma.project.deleteMany({
    where: {
      id: { in: ids },
      userId: user.id,
    },
  });

  return NextResponse.json({ ok: true, count });
});
