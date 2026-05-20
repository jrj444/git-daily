import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireAdmin } from "@/lib/session";

export const GET = withErrors(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      gitlabBaseUrl: true,
      gitlabEmail: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
});

const CreateBody = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(50),
  role: z.enum(["MEMBER", "ADMIN"]).optional(),
});

export const POST = withErrors(async (req: Request) => {
  await requireAdmin();
  const body = CreateBody.parse(await req.json());
  const exists = await prisma.user.findUnique({
    where: { username: body.username },
  });
  if (exists)
    return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
  const passwordHash = await bcrypt.hash(body.password, 10);
  const u = await prisma.user.create({
    data: {
      username: body.username,
      passwordHash,
      displayName: body.displayName,
      role: body.role || "MEMBER",
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ user: u });
});

const PatchBody = z.object({
  id: z.string(),
  password: z.string().min(6).max(200).optional(),
  displayName: z.string().min(1).max(50).optional(),
  role: z.enum(["MEMBER", "ADMIN"]).optional(),
});

export const PATCH = withErrors(async (req: Request) => {
  await requireAdmin();
  const body = PatchBody.parse(await req.json());
  const data: any = {};
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);
  if (body.displayName) data.displayName = body.displayName;
  if (body.role) data.role = body.role;
  const u = await prisma.user.update({
    where: { id: body.id },
    data,
    select: { id: true, username: true, displayName: true, role: true },
  });
  return NextResponse.json({ user: u });
});

export const DELETE = withErrors(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
