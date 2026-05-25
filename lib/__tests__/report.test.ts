import { describe, it, expect } from "vitest";
import { parseConventional, filterCommits, dedupe } from "../report";
import type { GitLabCommit } from "../gitlab";
import type { CleanCommit } from "../report";

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
