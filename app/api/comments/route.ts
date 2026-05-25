import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";

export const GET = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const reportId = url.searchParams.get("reportId");

  if (!reportId) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  // Check access: user must be report owner or admin
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { userId: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (report.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await prisma.comment.findMany({
    where: { reportId },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  return NextResponse.json({ comments });
});

const PostBody = z.object({
  reportId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export const POST = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PostBody.parse(await req.json());

  // Verify report exists
  const report = await prisma.report.findUnique({
    where: { id: body.reportId },
    select: { userId: true, date: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Access check: user must be report owner or admin
  if (report.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: {
      reportId: body.reportId,
      authorId: user.id,
      content: body.content,
    },
    include: {
      author: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });

  // Create notification for the report owner (skip if self-comment)
  if (report.userId !== user.id) {
    const dateStr = new Date(report.date).toISOString().slice(0, 10);
    await prisma.notification.create({
      data: {
        userId: report.userId,
        type: "comment",
        title: `${user.username} 评论了你 ${dateStr} 的日报`,
        body: body.content.slice(0, 100),
        relatedId: body.reportId,
      },
    });
  }

  return NextResponse.json({ comment });
});

export const DELETE = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only author or admin can delete
  if (comment.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
