import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";
import { computeUserStats } from "@/lib/stats";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const Query = z.object({
  startDate: z.string().regex(dateRe, "expected YYYY-MM-DD"),
  endDate: z.string().regex(dateRe, "expected YYYY-MM-DD"),
  userId: z.string().optional(),
});

export const GET = withErrors(async (req: Request) => {
  const session = await requireUser();
  const url = new URL(req.url);
  const q = Query.parse({
    startDate: url.searchParams.get("startDate") || "",
    endDate: url.searchParams.get("endDate") || "",
    userId: url.searchParams.get("userId") || undefined,
  });

  // Admin override: when querying a different user, require ADMIN role.
  const targetUserId = q.userId || session.id;
  if (targetUserId !== session.id && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = dayjs(q.startDate).startOf("day").toISOString();
  const until = dayjs(q.endDate).add(1, "day").startOf("day").toISOString();

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.gitlabBaseUrl || !user.gitlabToken) {
    return NextResponse.json(
      { error: "该用户尚未配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }

  const stats = await computeUserStats(user, since, until);
  if (!stats) {
    return NextResponse.json(
      { error: "该用户尚未配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }

  return NextResponse.json(stats);
});
