import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";
import { createNotification } from "@/lib/notify";

export const GET = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const reportId = url.searchParams.get("reportId");

  if (!reportId) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  const count = await prisma.like.count({ where: { reportId } });
  const liked = !!(await prisma.like.findUnique({
    where: { reportId_userId: { reportId, userId: user.id } },
  }));

  return NextResponse.json({ count, liked });
});

const PostBody = z.object({
  reportId: z.string().min(1),
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

  // Toggle like
  const existing = await prisma.like.findUnique({
    where: { reportId_userId: { reportId: body.reportId, userId: user.id } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.like.create({
      data: { reportId: body.reportId, userId: user.id },
    });
    liked = true;

    // Notify report owner on like (not on unlike, not self)
    if (report.userId !== user.id) {
      const dateStr = new Date(report.date).toISOString().slice(0, 10);
      await createNotification({
        userId: report.userId,
        type: "like",
        title: `${user.username} 点赞了你 ${dateStr} 的日报`,
        relatedId: body.reportId,
      });
    }
  }

  const count = await prisma.like.count({ where: { reportId: body.reportId } });
  return NextResponse.json({ count, liked });
});
