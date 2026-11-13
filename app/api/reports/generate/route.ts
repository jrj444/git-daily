import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { resolveGitLabToken } from "@/lib/gitlab-token";
import { withErrors, requireUser } from "@/lib/session";
import { listCommits } from "@/lib/gitlab";
import {
  buildContext,
  buildPromptMessages,
  generateEmptyReport,
  DEFAULT_PROMPT,
} from "@/lib/report";
import { callLLM } from "@/lib/llm";

const Query = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional(),
  templateId: z.string().optional(),
  projectIds: z.string().optional(), // comma-separated db ids
  extraNotes: z.string().optional(),
});

async function handleGenerate(req: Request) {
  const session = await requireUser();
  let q: z.infer<typeof Query>;

  if (req.method === "POST") {
    const json = await req.json().catch(() => ({}));
    q = Query.parse(json);
  } else {
    const url = new URL(req.url);
    q = Query.parse({
      date: url.searchParams.get("date") || undefined,
      templateId: url.searchParams.get("templateId") || undefined,
      projectIds: url.searchParams.get("projectIds") || undefined,
      extraNotes: url.searchParams.get("extraNotes") || undefined,
    });
  }

  const date = q.date || dayjs().format("YYYY-MM-DD");
  const since = dayjs(date).startOf("day").toISOString();
  const until = dayjs(date).add(1, "day").startOf("day").toISOString();

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.gitlabBaseUrl || !user.gitlabToken) {
    return NextResponse.json(
      { error: "请先在『设置』中配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }

  const projectFilter = q.projectIds?.split(",").filter(Boolean);
  const projects = await prisma.project.findMany({
    where: {
      userId: user.id,
      enabled: true,
      ...(projectFilter?.length ? { id: { in: projectFilter } } : {}),
    },
  });

  const token = await resolveGitLabToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: "请先在『设置』中配置 GitLab 地址与 Token" },
      { status: 400 }
    );
  }
  const opts = { baseUrl: user.gitlabBaseUrl!, token };

  const groups = await Promise.all(
    projects.map(async (p) => {
      try {
        const commits = await listCommits(opts, {
          projectId: p.gitlabProjectId,
          since,
          until,
          branch: p.defaultBranch || undefined,
        });
        return {
          project: {
            name_with_namespace: p.alias || p.nameWithNamespace,
            web_url: p.webUrl || "",
          },
          commits,
          error: null as string | null,
        };
      } catch (e: any) {
        return {
          project: {
            name_with_namespace: p.alias || p.nameWithNamespace,
            web_url: p.webUrl || "",
          },
          commits: [],
          error: e?.message || String(e),
        };
      }
    })
  );

  // Pick prompt template
  let promptBody = DEFAULT_PROMPT;
  let templateId: string | null = null;
  if (q.templateId) {
    const tpl = await prisma.template.findFirst({
      where: { id: q.templateId, userId: user.id },
    });
    if (tpl) {
      promptBody = tpl.body;
      templateId = tpl.id;
    }
  } else {
    const tpl = await prisma.template.findFirst({
      where: { userId: user.id, isDefault: true },
    });
    if (tpl) {
      promptBody = tpl.body;
      templateId = tpl.id;
    }
  }

  const ctx = buildContext(
    date,
    groups,
    {
      authorEmail: user.gitlabEmail || undefined,
      noiseRegex: user.noiseRegex,
      dropMerges: true,
    },
    { displayName: user.displayName, email: user.gitlabEmail || undefined }
  );

  let content = "";
  const hasExtraNotes = Boolean(q.extraNotes?.trim());
  if (ctx.total === 0 && !hasExtraNotes) {
    content = generateEmptyReport();
  } else {
    try {
      const messages = buildPromptMessages(promptBody, ctx, q.extraNotes);
      content = await callLLM(messages);
    } catch (e: any) {
      console.error("[generate AI error]", e);
      return NextResponse.json(
        { error: `AI 生成失败: ${e?.message || e}` },
        { status: 502 }
      );
    }
  }

  const errors = groups.filter((g) => g.error).map((g) => ({
    project: g.project.name_with_namespace,
    error: g.error!,
  }));

  return NextResponse.json({
    date,
    content,
    templateId,
    context: ctx,
    errors,
  });
}

export const GET = withErrors(handleGenerate);
export const POST = withErrors(handleGenerate);
