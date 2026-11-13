import { describe, it, expect } from "vitest";
import {
  parseConventional,
  filterCommits,
  dedupe,
  buildContext,
  renderTemplate,
  DEFAULT_TEMPLATE_BODY,
  DEFAULT_PROMPT,
  formatCommitsForPrompt,
  buildPromptMessages,
  generateEmptyReport,
  parseProjectNotes,
  type BusinessProjectGroup,
} from "../report";
import type { GitLabCommit } from "../gitlab";
import type { CleanCommit, GroupedSource } from "../report";

// --- parseConventional ---

describe("parseConventional", () => {
  it("parses standard format: feat: add login", () => {
    const result = parseConventional("feat: add login");
    expect(result).toEqual({ type: "feat", scope: undefined, subject: "add login" });
  });

  it("parses with scope: fix(auth): token expired", () => {
    const result = parseConventional("fix(auth): token expired");
    expect(result).toEqual({ type: "fix", scope: "auth", subject: "token expired" });
  });

  it("parses fullwidth Chinese punctuation: feat（scope）：subject", () => {
    const result = parseConventional("feat（scope）：subject");
    expect(result).toEqual({ type: "feat", scope: "scope", subject: "subject" });
  });

  it("parses mixed punctuation: fix(core)：bug fix", () => {
    const result = parseConventional("fix(core)：bug fix");
    expect(result).toEqual({ type: "fix", scope: "core", subject: "bug fix" });
  });

  it("parses fullwidth parens with ASCII colon: feat（ui）: update style", () => {
    const result = parseConventional("feat（ui）: update style");
    expect(result).toEqual({ type: "feat", scope: "ui", subject: "update style" });
  });

  it("returns subject only for plain message (no match)", () => {
    const result = parseConventional("just a plain commit message");
    expect(result).toEqual({ subject: "just a plain commit message" });
  });

  it("only parses first line of multi-line message", () => {
    const result = parseConventional("feat: first line\n\nsome body text\nmore details");
    expect(result).toEqual({ type: "feat", scope: undefined, subject: "first line" });
  });

  it("trims whitespace from first line", () => {
    const result = parseConventional("  fix: trimmed  ");
    expect(result).toEqual({ type: "fix", scope: undefined, subject: "trimmed" });
  });
});

// --- filterCommits ---

function makeCommit(overrides: Partial<GitLabCommit> = {}): GitLabCommit {
  return {
    id: "abc123",
    short_id: "abc",
    title: "test commit",
    message: "test commit",
    author_name: "Test User",
    author_email: "test@example.com",
    authored_date: "2026-05-14T10:00:00Z",
    committed_date: "2026-05-14T10:00:00Z",
    parent_ids: ["parent1"],
    web_url: "https://gitlab.com/commit/abc123",
    ...overrides,
  };
}

describe("filterCommits", () => {
  it("drops merge commits by default", () => {
    const commits = [
      makeCommit({ id: "1", parent_ids: ["a"] }),
      makeCommit({ id: "2", parent_ids: ["a", "b"] }), // merge commit
    ];
    const result = filterCommits(commits, {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("keeps merge commits when dropMerges=false", () => {
    const commits = [
      makeCommit({ id: "1", parent_ids: ["a", "b"] }),
    ];
    const result = filterCommits(commits, { dropMerges: false });
    expect(result).toHaveLength(1);
  });

  it("filters by authorEmail (case-insensitive)", () => {
    const commits = [
      makeCommit({ id: "1", author_email: "Alice@Company.com" }),
      makeCommit({ id: "2", author_email: "bob@company.com" }),
    ];
    const result = filterCommits(commits, { authorEmail: "alice@company.com" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("applies noise regex filter", () => {
    const commits = [
      makeCommit({ id: "1", title: "feat: real work" }),
      makeCommit({ id: "2", title: "Merge branch 'main' into dev" }),
      makeCommit({ id: "3", title: "WIP: half done" }),
    ];
    const result = filterCommits(commits, { noiseRegex: "^(Merge|WIP)" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("ignores invalid noise regex gracefully", () => {
    const commits = [makeCommit({ id: "1", title: "test" })];
    const result = filterCommits(commits, { noiseRegex: "[invalid(" });
    expect(result).toHaveLength(1);
  });
});

// --- dedupe ---

function makeCleanCommit(overrides: Partial<CleanCommit> = {}): CleanCommit {
  return {
    id: "abc123",
    short_id: "abc",
    title: "add login",
    message: "feat: add login",
    author_email: "test@example.com",
    authored_date: "2026-05-14T10:00:00Z",
    web_url: "https://gitlab.com/commit/abc123",
    type: "feat",
    scope: undefined,
    ...overrides,
  };
}

describe("dedupe", () => {
  it("removes duplicate commits by type+scope+title", () => {
    const commits = [
      makeCleanCommit({ id: "1", title: "Add Login", type: "feat" }),
      makeCleanCommit({ id: "2", title: "add login", type: "feat" }), // same (case-insensitive)
      makeCleanCommit({ id: "3", title: "fix bug", type: "fix" }),
    ];
    const result = dedupe(commits);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1"); // keeps first occurrence
    expect(result[1].id).toBe("3");
  });

  it("treats different scopes as different commits", () => {
    const commits = [
      makeCleanCommit({ id: "1", title: "update", type: "feat", scope: "ui" }),
      makeCleanCommit({ id: "2", title: "update", type: "feat", scope: "api" }),
    ];
    const result = dedupe(commits);
    expect(result).toHaveLength(2);
  });

  it("treats different types as different commits", () => {
    const commits = [
      makeCleanCommit({ id: "1", title: "handle error", type: "feat" }),
      makeCleanCommit({ id: "2", title: "handle error", type: "fix" }),
    ];
    const result = dedupe(commits);
    expect(result).toHaveLength(2);
  });
});

// --- buildContext & renderTemplate ---

describe("buildContext and renderTemplate", () => {
  it("builds context with idx on projects and renders standard 4-section report", () => {
    const groups: GroupedSource[] = [
      {
        project: { name_with_namespace: "平云商城", web_url: "https://gitlab.example.com/mall" },
        commits: [
          makeCommit({
            id: "1",
            title: "图标体系收敛为 common iconfont",
            message: "feat: 图标体系收敛为 common iconfont",
          }),
        ],
      },
      {
        project: { name_with_namespace: "党建产品", web_url: "https://gitlab.example.com/party" },
        commits: [
          makeCommit({
            id: "2",
            title: "对齐 PRD 修正原型差异",
            message: "feat: 对齐 PRD 修正原型差异",
          }),
        ],
      },
    ];

    const ctx = buildContext("2026-11-13", groups, {}, { displayName: "江锐健" });
    expect(ctx.projects).toHaveLength(2);
    expect(ctx.projects[0].idx).toBe(1);
    expect(ctx.projects[0].name).toBe("平云商城");
    expect(ctx.projects[1].idx).toBe(2);
    expect(ctx.projects[1].name).toBe("党建产品");

    const output = renderTemplate(DEFAULT_TEMPLATE_BODY, ctx);
    expect(output).toContain("今日计划完成工作:");
    expect(output).toContain("1. 平云商城 - 迭代优化");
    expect(output).toContain("2. 党建产品 - 迭代优化");
    expect(output).toContain("今日实际完成工作:");
    expect(output).toContain("图标体系收敛为 common iconfont");
    expect(output).toContain("对齐 PRD 修正原型差异");
    expect(output).toContain("未完成工作及原因:\n无");
    expect(output).toContain("明日工作计划:");
    expect(output).toContain("1. 平云商城 - 优化迭代");
    expect(output).toContain("2. 党建产品 - 优化迭代");
  });

  it("renders empty fallback when projects are empty", () => {
    const ctx = buildContext("2026-11-13", [], {}, { displayName: "江锐健" });
    const output = renderTemplate(DEFAULT_TEMPLATE_BODY, ctx);

    expect(output).toContain("今日计划完成工作:\n1. 迭代优化");
    expect(output).toContain("今日实际完成工作:\n（今日无提交记录）");
    expect(output).toContain("未完成工作及原因:\n无");
    expect(output).toContain("明日工作计划:\n1. 优化迭代");
  });
});

// --- AI Prompt Formatting & Messages ---

describe("AI Prompt generation helpers", () => {
  const sampleProjects = [
    {
      idx: 1,
      name: "平云商城",
      webUrl: "https://gitlab.example.com/mall",
      commits: [
        makeCleanCommit({ id: "1", title: "后台列表页统一", type: "feat" }),
        makeCleanCommit({ id: "2", title: "修复按钮重叠", type: "fix" }),
      ],
    },
  ];

  it("formatCommitsForPrompt formats commits cleanly by project", () => {
    const text = formatCommitsForPrompt(
      sampleProjects,
      "2026-11-13",
      { displayName: "江锐健" }
    );
    expect(text).toContain("日期：2026-11-13");
    expect(text).toContain("开发者：江锐健");
    expect(text).toContain("【平云商城】");
    expect(text).toContain("- [feat] 后台列表页统一");
    expect(text).toContain("- [fix] 修复按钮重叠");
  });

  it("formatCommitsForPrompt handles empty projects", () => {
    const text = formatCommitsForPrompt([], "2026-11-13", { displayName: "江锐健" });
    expect(text).toContain("（无代码提交）");
  });

  it("formatCommitsForPrompt handles extra non-code notes", () => {
    const text = formatCommitsForPrompt(
      sampleProjects,
      "2026-11-13",
      { displayName: "江锐健" },
      "1. 参加电商二期需求评审会\n2. 输出接口设计文档"
    );
    expect(text).toContain("今日其他日常工作（会议/文档/项目管理/协同等）：");
    expect(text).toContain("参加电商二期需求评审会");
    expect(text).toContain("输出接口设计文档");
  });

  it("buildPromptMessages formats system and user messages", () => {
    const ctx = {
      date: "2026-11-13",
      total: 2,
      projects: sampleProjects,
      user: { displayName: "江锐健" },
    };

    const messages = buildPromptMessages(DEFAULT_PROMPT, ctx);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("今日计划完成工作:");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("【平云商城】");
  });

  it("buildPromptMessages substitutes {{commits}} if present", () => {
    const ctx = {
      date: "2026-11-13",
      total: 2,
      projects: sampleProjects,
      user: { displayName: "江锐健" },
    };

    const customPrompt = "请总结以下提交：\n{{commits}}\n输出日报。";
    const messages = buildPromptMessages(customPrompt, ctx);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("【平云商城】");
    expect(messages[0].content).toContain("输出日报。");
  });

  it("generateEmptyReport produces 4-section empty report", () => {
    const rep = generateEmptyReport();
    expect(rep).toContain("今日计划完成工作:");
    expect(rep).toContain("今日实际完成工作:\n（今日无提交记录）");
    expect(rep).toContain("未完成工作及原因:\n无");
    expect(rep).toContain("明日工作计划:");
  });

  describe("parseProjectNotes", () => {
    it("correctly routes notes with brackets and general notes", () => {
      const extraNotes = `
        - [平云商城] 参加 2.0 需求评审会议
        - 【用户中台】输出鉴权改造技术文档
        - 跨组部门周会与线上排障
      `;
      const { projectNotesMap, generalNotes } = parseProjectNotes(extraNotes, [
        "平云商城",
        "用户中台",
      ]);

      expect(projectNotesMap["平云商城"]).toEqual(["参加 2.0 需求评审会议"]);
      expect(projectNotesMap["用户中台"]).toEqual(["输出鉴权改造技术文档"]);
      expect(generalNotes).toEqual(["跨组部门周会与线上排障"]);
    });

    it("handles empty notes", () => {
      const { projectNotesMap, generalNotes } = parseProjectNotes("", [
        "平云商城",
      ]);
      expect(projectNotesMap["平云商城"]).toEqual([]);
      expect(generalNotes).toEqual([]);
    });
  });

  describe("BusinessProjectGroup formatting", () => {
    it("formats multiple repositories and project notes under a business project", () => {
      const businessProjects: BusinessProjectGroup[] = [
        {
          projectName: "平云商城",
          repositories: [
            {
              repoName: "server-api",
              repoAlias: "服务端",
              commits: [
                {
                  id: "1",
                  short_id: "c1",
                  title: "增加下单幂等校验",
                  message: "feat: 增加下单幂等校验",
                  author_email: "test@example.com",
                  authored_date: "2026-11-13T10:00:00Z",
                  web_url: "https://gitlab.example.com/server-api",
                  type: "feat",
                },
              ],
            },
            {
              repoName: "web-portal",
              repoAlias: "前端门户",
              commits: [
                {
                  id: "2",
                  short_id: "c2",
                  title: "优化商品详情轮播",
                  message: "fix: 优化商品详情轮播",
                  author_email: "test@example.com",
                  authored_date: "2026-11-13T11:00:00Z",
                  web_url: "https://gitlab.example.com/web-portal",
                  type: "fix",
                },
              ],
            },
          ],
          projectNotes: ["参加 2.0 需求评审会议", "输出微服务架构文档"],
        },
      ];

      const formatted = formatCommitsForPrompt(
        businessProjects,
        "2026-11-13",
        { displayName: "江锐健" },
        undefined,
        ["部门周会"]
      );

      expect(formatted).toContain("【项目：平云商城】");
      expect(formatted).toContain("[服务端 (server-api)] [feat] 增加下单幂等校验");
      expect(formatted).toContain("[前端门户 (web-portal)] [fix] 优化商品详情轮播");
      expect(formatted).toContain("- 参加 2.0 需求评审会议");
      expect(formatted).toContain("- 输出微服务架构文档");
      expect(formatted).toContain("【综合事务 / 跨项目日常】：");
      expect(formatted).toContain("- 部门周会");
    });
  });
});
