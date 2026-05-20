import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** Always produce UTC midnight so MySQL DATE comparisons are consistent */
function utcDate(str: string): Date {
  return new Date(str + "T00:00:00.000Z");
}

export const GET = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const month = url.searchParams.get("month"); // YYYY-MM

  if (date) {
    if (!dateRe.test(date)) {
      return NextResponse.json({ error: "bad date" }, { status: 400 });
    }
    const report = await prisma.report.findUnique({
      where: { userId_date: { userId: user.id, date: utcDate(date) } },
    });
    return NextResponse.json({ report });
  }

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "bad month" }, { status: 400 });
    }
    const start = utcDate(month + "-01");
    const [y, m] = month.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0)); // last day of the month at UTC midnight
    const reports = await prisma.report.findMany({
      where: { userId: user.id, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, updatedAt: true },
    });
    return NextResponse.json({ reports });
  }

  const reports = await prisma.report.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 60,
    select: { id: true, date: true, updatedAt: true },
  });
  return NextResponse.json({ reports });
});

const SaveBody = z.object({
  date: z.string().regex(dateRe),
  content: z.string(),
  templateId: z.string().optional().nullable(),
  rawCommits: z.any().optional(),
});

export const POST = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = SaveBody.parse(await req.json());
  const dateObj = utcDate(body.date);

  const report = await prisma.report.upsert({
    where: { userId_date: { userId: user.id, date: dateObj } },
    update: {
      content: body.content,
      templateId: body.templateId ?? null,
      rawCommits: body.rawCommits ?? undefined,
    },
    create: {
      userId: user.id,
      date: dateObj,
      content: body.content,
      templateId: body.templateId ?? null,
      rawCommits: body.rawCommits ?? undefined,
    },
  });
  return NextResponse.json({ report });
});

export const DELETE = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date || !dateRe.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  await prisma.report.deleteMany({
    where: { userId: user.id, date: utcDate(date) },
  });
  return NextResponse.json({ ok: true });
});
