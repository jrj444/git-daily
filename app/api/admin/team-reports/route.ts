import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireAdmin } from "@/lib/session";

export const GET = withErrors(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || dayjs().format("YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const dateObj = dayjs(date).toDate();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, displayName: true, role: true },
  });
  const reports = await prisma.report.findMany({
    where: { date: dateObj },
    select: {
      id: true,
      userId: true,
      content: true,
      updatedAt: true,
    },
  });
  const map = new Map(reports.map((r) => [r.userId, r]));
  const rows = users.map((u) => ({
    user: u,
    report: map.get(u.id) || null,
  }));
  return NextResponse.json({ date, rows });
});
