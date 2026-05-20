import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { withErrors, requireUser } from "@/lib/session";
import { listCommits } from "@/lib/gitlab";
import { filterCommits, parseConventional } from "@/lib/report";

const KNOWN_TYPES = [
  "feat",
  "fix",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
  "perf",
  "ci",
  "build",
] as const;

type CommitType = (typeof KNOWN_TYPES)[number] | "other";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const Query = z.object({
  startDate: z.string().regex(dateRe, "expected YYYY-MM-DD"),
  endDate: z.string().regex(dateRe, "expected YYYY-MM-DD"),
});

function categorize(type: string | undefined): CommitType {
  if (!type) return "other";
  const lower = type.toLowerCase();
  if ((KNOWN_TYPES as readonly string[]).includes(lower))
    return lower as CommitType;
  return "other";
}

function emptyBreakdown(): Record<CommitType, number> {
  const bd: Record<string, number> = {};
  for (const t of KNOWN_TYPES) bd[t] = 0;
  bd["other"] = 0;
  return bd as Record<CommitType, number>;
}

export const GET = withErrors(async (req: Request) => {
  const session = await requireUser();
  const url = new URL(req.url);
  const q = Query.parse({
    startDate: url.searchParams.get("startDate") || "",
    endDate: url.searchParams.get("endDate") || "",
  });

  const since = dayjs(q.startDate).startOf("day").toISOString();
  const until = dayjs(q.endDate).add(1, "day").startOf("day").toISOString();

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.gitlabBaseUrl || !user.gitlabToken) {
    return NextResponse.json(
      { error: "请先在『设置』中配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }

  const projects = await prisma.project.findMany({
    where: { userId: user.id, enabled: true },
  });

  const token = decrypt(user.gitlabToken);
  const opts = { baseUrl: user.gitlabBaseUrl, token };

  const totalBreakdown = emptyBreakdown();
  let total = 0;
  const byProject: {
    name: string;
    total: number;
    breakdown: Record<CommitType, number>;
  }[] = [];

  await Promise.all(
    projects.map(async (p) => {
      try {
        const commits = await listCommits(opts, {
          projectId: p.gitlabProjectId,
          since,
          until,
          branch: p.defaultBranch || undefined,
        });

        const filtered = filterCommits(commits, {
          authorEmail: user.gitlabEmail || undefined,
          noiseRegex: user.noiseRegex,
          dropMerges: true,
        });

        const projBreakdown = emptyBreakdown();
        let projTotal = 0;

        for (const c of filtered) {
          const parsed = parseConventional(c.message || c.title || "");
          const cat = categorize(parsed.type);
          projBreakdown[cat]++;
          totalBreakdown[cat]++;
          projTotal++;
          total++;
        }

        if (projTotal > 0) {
          byProject.push({
            name: p.alias || p.nameWithNamespace,
            total: projTotal,
            breakdown: projBreakdown,
          });
        }
      } catch {
        // skip failed projects silently for stats
      }
    })
  );

  // Sort by project total descending
  byProject.sort((a, b) => b.total - a.total);

  return NextResponse.json({ total, breakdown: totalBreakdown, byProject });
});
