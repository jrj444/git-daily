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

export function emptyBreakdown(): Record<CommitType, number> {
  return {
    feat: 0,
    fix: 0,
    refactor: 0,
    docs: 0,
    style: 0,
    test: 0,
    chore: 0,
    perf: 0,
    ci: 0,
    build: 0,
    other: 0,
  };
}

function categorize(type?: string): CommitType {
  if (!type) return "other";
  const lower = type.toLowerCase() as CommitType;
  return (KNOWN_TYPES as readonly string[]).includes(lower) ? lower : "other";
}

export type StatsUser = {
  id: string;
  gitlabBaseUrl: string | null;
  gitlabToken: string | null;
  gitlabEmail: string | null;
  noiseRegex: string | null;
};

/**
 * Compute commit statistics for a user across all their enabled repositories,
 * grouped at the Business Project level.
 * Returns null when the user has no GitLab credentials configured.
 */
export async function computeUserStats(
  user: StatsUser,
  since: string,
  until: string
): Promise<UserStats | null> {
  if (!user.gitlabBaseUrl || !user.gitlabToken) return null;

  const repositories = await prisma.repository.findMany({
    where: { userId: user.id, enabled: true },
    include: { project: true },
  });

  const token = await resolveGitLabToken(user.id);
  if (!token) return null;
  const opts = { baseUrl: user.gitlabBaseUrl!, token };

  const totalBreakdown = emptyBreakdown();
  let total = 0;
  const projectMap = new Map<string, ProjectStat>();
  const dailyMap = new Map<string, DailyPoint>();

  await Promise.all(
    repositories.map(async (r) => {
      try {
        const commits = await listCommits(opts, {
          projectId: r.gitlabProjectId,
          since,
          until,
          branch: r.defaultBranch || undefined,
        });

        const filtered = filterCommits(commits, {
          authorEmail: user.gitlabEmail || undefined,
          noiseRegex: user.noiseRegex,
          dropMerges: true,
        });

        const projName = r.project?.name || r.alias || r.nameWithNamespace;
        let projStat = projectMap.get(projName);
        if (!projStat) {
          projStat = {
            name: projName,
            total: 0,
            breakdown: emptyBreakdown(),
            commits: [],
          };
          projectMap.set(projName, projStat);
        }

        for (const c of filtered) {
          const parsed = parseConventional(c.message || c.title || "");
          const cat = categorize(parsed.type);
          projStat.breakdown[cat]++;
          totalBreakdown[cat]++;
          projStat.total++;
          total++;

          const repoLabel = r.alias || r.nameWithNamespace.split("/").pop();
          const titleWithRepo = r.project
            ? `[${repoLabel}] ${parsed.subject || c.title || c.message || ""}`
            : parsed.subject || c.title || c.message || "";

          projStat.commits.push({
            short_id: c.short_id,
            title: titleWithRepo,
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
      } catch {
        // skip failed repositories silently for stats
      }
    })
  );

  const byProject = [...projectMap.values()].filter((p) => p.total > 0);
  for (const p of byProject) {
    p.commits.sort((a, b) => b.authored_date.localeCompare(a.authored_date));
  }
  byProject.sort((a, b) => b.total - a.total);

  const dailyTrend = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return { total, breakdown: totalBreakdown, byProject, dailyTrend };
}
