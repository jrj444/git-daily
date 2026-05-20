import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/report";

export const GET = withErrors(async () => {
  const user = await requireUser();
  let templates = await prisma.template.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  if (templates.length === 0) {
    const t = await prisma.template.create({
      data: {
        userId: user.id,
        name: "默认模板",
        body: DEFAULT_TEMPLATE_BODY,
        isDefault: true,
      },
    });
    templates = [t];
  }
  return NextResponse.json({ templates });
});

const CreateBody = z.object({
  name: z.string().min(1).max(50),
  body: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const POST = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = CreateBody.parse(await req.json());
  if (body.isDefault) {
    await prisma.template.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  const t = await prisma.template.create({
    data: {
      userId: user.id,
      name: body.name,
      body: body.body,
      isDefault: !!body.isDefault,
    },
  });
  return NextResponse.json({ template: t });
});

const UpdateBody = z.object({
  id: z.string(),
  name: z.string().min(1).max(50).optional(),
  body: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = UpdateBody.parse(await req.json());
  const t = await prisma.template.findFirst({
    where: { id: body.id, userId: user.id },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.isDefault) {
    await prisma.template.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
  }
  const updated = await prisma.template.update({
    where: { id: t.id },
    data: {
      name: body.name ?? t.name,
      body: body.body ?? t.body,
      isDefault: body.isDefault ?? t.isDefault,
    },
  });
  return NextResponse.json({ template: updated });
});

export const DELETE = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const t = await prisma.template.findFirst({
    where: { id, userId: user.id },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.template.delete({ where: { id: t.id } });
  return NextResponse.json({ ok: true });
});
