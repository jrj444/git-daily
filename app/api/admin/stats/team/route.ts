import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireAdmin } from "@/lib/session";
import {
  computeUserStats,
  emptyBreakdown,
  type CommitType,
} from "@/lib/stats";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const GET = withErrors(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  const since = dayjs(startDate).startOf("day").toISOString();
  const until = dayjs(endDate).add(1, "day").startOf("day").toISOString();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      gitlabBaseUrl: true,
      gitlabToken: true,
      gitlabEmail: true,
      noiseRegex: true,
    },
  });

  const totalBreakdown = emptyBreakdown();
  let total = 0;
  const byUser: {
    user: { id: string; username: string; displayName: string };
    total: number;
    breakdown: Record<CommitType, number>;
  }[] = [];

  await Promise.all(
    users.map(async (u) => {
      try {
        const stats = await computeUserStats(u, since, until);
        if (!stats) return;
        total += stats.total;
        for (const [k, v] of Object.entries(stats.breakdown)) {
          totalBreakdown[k as CommitType] += v;
        }
        if (stats.total > 0) {
          byUser.push({
            user: {
              id: u.id,
              username: u.username,
              displayName: u.displayName,
            },
            total: stats.total,
            breakdown: stats.breakdown,
          });
        }
      } catch {
        // skip failed users silently
      }
    })
  );

  byUser.sort((a, b) => b.total - a.total);

  return NextResponse.json({ total, breakdown: totalBreakdown, byUser });
});
