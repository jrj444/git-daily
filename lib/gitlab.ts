/**
 * GitLab REST API client.
 * All calls go through this module from server-side only — never expose tokens to client.
 */

export type GitLabUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  public_email?: string;
};

export type GitLabProject = {
  id: number;
  name: string;
  path_with_namespace: string;
  name_with_namespace: string;
  default_branch: string | null;
  web_url: string;
};

export type GitLabCommit = {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committed_date: string;
  parent_ids: string[];
  web_url: string;
};

export type GitLabClientOpts = {
  baseUrl: string;
  token: string;
};

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

async function gl<T>(
  opts: GitLabClientOpts,
  path: string,
  init?: RequestInit & {
    query?: Record<string, string | number | undefined>;
    timeoutMs?: number;
  }
): Promise<{ data: T; headers: Headers }> {
  const url = new URL(normalizeBase(opts.baseUrl) + path);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? 60_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      ...init,
      headers: {
        "PRIVATE-TOKEN": opts.token,
        Accept: "application/json",
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitLab ${res.status}: ${body || res.statusText}`);
    }
    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCurrentUser(opts: GitLabClientOpts): Promise<GitLabUser> {
  const { data } = await gl<GitLabUser>(opts, "/api/v4/user");
  return data;
}

export async function validateToken(opts: GitLabClientOpts): Promise<GitLabUser> {
  return getCurrentUser(opts);
}

export async function listProjects(
  opts: GitLabClientOpts,
  options?: { maxPages?: number; onPartial?: (acc: GitLabProject[]) => void }
): Promise<GitLabProject[]> {
  const all: GitLabProject[] = [];
  let page = 1;
  const maxPages = options?.maxPages ?? 20;
  while (true) {
    const { data, headers } = await gl<GitLabProject[]>(opts, "/api/v4/projects", {
      query: {
        membership: "true",
        simple: "true",
        order_by: "last_activity_at",
        per_page: 100,
        page,
      },
      timeoutMs: 30_000,
    });
    all.push(...data);
    options?.onPartial?.(all);
    const next = headers.get("x-next-page");
    if (!next) break;
    page = Number(next);
    if (page > maxPages) break;
  }
  return all;
}

/** Look up a single project by numeric id or by URL-encoded path (group/subgroup/repo). */
export async function getProject(
  opts: GitLabClientOpts,
  idOrPath: string
): Promise<GitLabProject> {
  const isNumeric = /^\d+$/.test(idOrPath);
  const ref = isNumeric
    ? idOrPath
    : encodeURIComponent(idOrPath.replace(/^\/+|\/+$/g, ""));
  const { data } = await gl<GitLabProject>(opts, `/api/v4/projects/${ref}`);
  return data;
}

export type ListCommitsArgs = {
  projectId: number;
  since: string; // ISO
  until: string; // ISO
  branch?: string;
};

export async function listCommits(
  opts: GitLabClientOpts,
  args: ListCommitsArgs
): Promise<GitLabCommit[]> {
  const all: GitLabCommit[] = [];
  let page = 1;
  while (true) {
    const { data, headers } = await gl<GitLabCommit[]>(
      opts,
      `/api/v4/projects/${args.projectId}/repository/commits`,
      {
        query: {
          since: args.since,
          until: args.until,
          ref_name: args.branch,
          per_page: 100,
          page,
          all: "true",
        },
      }
    );
    all.push(...data);
    const next = headers.get("x-next-page");
    if (!next) break;
    page = Number(next);
    if (page > 20) break;
  }
  return all;
}
