import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";
import { utcDate } from "@/lib/utils";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 92;

export const GET = withErrors(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";

  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return NextResponse.json({ error: "日期格式错误" }, { status: 400 });
  }

  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (end.isBefore(start)) {
    return NextResponse.json(
      { error: "结束日期不能早于开始日期" },
      { status: 400 }
    );
  }
  if (end.diff(start, "day") + 1 > MAX_DAYS) {
    return NextResponse.json(
      { error: `范围不能超过 ${MAX_DAYS} 天` },
      { status: 400 }
    );
  }

  const reports = await prisma.report.findMany({
    where: {
      userId: user.id,
      date: { gte: utcDate(startDate), lte: utcDate(endDate) },
    },
    orderBy: { date: "asc" },
    select: { date: true, content: true },
  });

  // Format date to YYYY-MM-DD string (UTC)
  const formatted = reports.map((r) => {
    const d = new Date(r.date);
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return { date: dateStr, content: r.content };
  });

  return NextResponse.json({ reports: formatted });
});
