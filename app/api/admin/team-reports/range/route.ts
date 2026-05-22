import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireAdmin } from "@/lib/session";
import { utcDate } from "@/lib/utils";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 92;

export const GET = withErrors(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (end.isBefore(start)) {
    return NextResponse.json(
      { error: "endDate must be >= startDate" },
      { status: 400 }
    );
  }
  const totalDays = end.diff(start, "day") + 1;
  if (totalDays > MAX_DAYS) {
    return NextResponse.json(
      { error: `range too large (max ${MAX_DAYS} days)` },
      { status: 400 }
    );
  }

  const days: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    days.push(start.add(i, "day").format("YYYY-MM-DD"));
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: { id: true, username: true, displayName: true, role: true },
  });

  const reports = await prisma.report.findMany({
    where: {
      date: {
        gte: utcDate(startDate),
        lte: utcDate(endDate),
      },
    },
    select: { userId: true, date: true },
  });

  const byUser = new Map<string, Set<string>>();
  for (const r of reports) {
    const d = new Date(r.date);
    const dStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (!byUser.has(r.userId)) byUser.set(r.userId, new Set());
    byUser.get(r.userId)!.add(dStr);
  }

  const rows = users.map((u) => ({
    user: u,
    submitted: Array.from(byUser.get(u.id) || []).sort(),
  }));

  return NextResponse.json({ days, rows });
});
