import { prisma } from "@/lib/prisma";
import { resolveGitLabToken } from "@/lib/gitlab-token";
import { listCommits } from "@/lib/gitlab";
import { filterCommits, parseConventional } from "@/lib/report";

export const KNOWN_TYPES = [
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

export type CommitType = (typeof KNOWN_TYPES)[number] | "other";

export type CommitItem = {
  short_id: string;
  title: string;
  type: CommitType;
  web_url: string | null;
  authored_date: string;
};

export type ProjectStat = {
  name: string;
  total: number;
  breakdown: Record<CommitType, number>;
  commits: CommitItem[];
};

export type DailyPoint = {
  date: string;       // "YYYY-MM-DD"
  total: number;
  feat: number;
  fix: number;
  refactor: number;
  other: number;      // sum of all other types
};

export type UserStats = {
  total: number;
  breakdown: Record<CommitType, number>;
  byProject: ProjectStat[];
  dailyTrend: DailyPoint[];
};

export function categorize(type: string | undefined): CommitType {
  if (!type) return "other";
  const lower = type.toLowerCase();
  if ((KNOWN_TYPES as readonly string[]).includes(lower))
    return lower as CommitType;
  return "other";
}

export function emptyBreakdown(): Record<CommitType, number> {
  const bd: Record<string, number> = {};
  for (const t of KNOWN_TYPES) bd[t] = 0;
  bd["other"] = 0;
  return bd as Record<CommitType, number>;
}

export type StatsUser = {
  id: string;
  gitlabBaseUrl: string | null;
  gitlabToken: string | null;
  gitlabEmail: string | null;
  noiseRegex: string | null;
};

/**
 * Compute commit statistics for a user across all their enabled projects.
 * Returns null when the user has no GitLab credentials configured.
 */
export async function computeUserStats(
  user: StatsUser,
  since: string,
  until: string
): Promise<UserStats | null> {
  if (!user.gitlabBaseUrl || !user.gitlabToken) return null;

  const projects = await prisma.project.findMany({
    where: { userId: user.id, enabled: true },
  });

  const token = await resolveGitLabToken(user.id);
  if (!token) return null;
  const opts = { baseUrl: user.gitlabBaseUrl!, token };

  const totalBreakdown = emptyBreakdown();
  let total = 0;
  const byProject: ProjectStat[] = [];
  const dailyMap = new Map<string, DailyPoint>();

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
        const projCommits: CommitItem[] = [];
        let projTotal = 0;

        for (const c of filtered) {
          const parsed = parseConventional(c.message || c.title || "");
          const cat = categorize(parsed.type);
          projBreakdown[cat]++;
          totalBreakdown[cat]++;
          projTotal++;
          total++;
          projCommits.push({
            short_id: c.short_id,
            title: parsed.subject || c.title || c.message || "",
            type: cat,
            web_url: c.web_url ?? null,
            authored_date: c.authored_date,
          });

          // Accumulate daily trend
          const day = c.authored_date.slice(0, 10); // "YYYY-MM-DD"
          let dp = dailyMap.get(day);
          if (!dp) {
            dp = { date: day, total: 0, feat: 0, fix: 0, refactor: 0, other: 0 };
            dailyMap.set(day, dp);
          }
          dp.total++;
          if (cat === "feat") dp.feat++;
          else if (cat === "fix") dp.fix++;
          else if (cat === "refactor") dp.refactor++;
          else dp.other++;
        }

        if (projTotal > 0) {
          projCommits.sort((a, b) =>
            b.authored_date.localeCompare(a.authored_date)
          );
          byProject.push({
            name: p.alias || p.nameWithNamespace,
            total: projTotal,
            breakdown: projBreakdown,
            commits: projCommits,
          });
        }
      } catch {
        // skip failed projects silently for stats
      }
    })
  );

  byProject.sort((a, b) => b.total - a.total);
  const dailyTrend = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { total, breakdown: totalBreakdown, byProject, dailyTrend };
}
