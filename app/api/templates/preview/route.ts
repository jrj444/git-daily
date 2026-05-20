import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { withErrors, requireUser } from "@/lib/session";
import { renderTemplate, type ReportContext } from "@/lib/report";

const Body = z.object({
  body: z.string().min(1, "模板内容不能为空"),
});

export const POST = withErrors(async (req: Request) => {
  await requireUser();
  const parsed = Body.parse(await req.json());

  const date = dayjs().format("YYYY-MM-DD");
  const ctx: ReportContext = {
    date,
    total: 2,
    user: { displayName: "示例用户", email: "you@example.com" },
    projects: [
      {
        name: "frontend/web (示例)",
        webUrl: "https://gitlab.example.com/frontend/web",
        commits: [
          {
            id: "ab12cd34ef56",
            short_id: "ab12cd34",
            title: "登录页加上记住我",
            message: "feat(auth): 登录页加上记住我",
            author_email: "you@example.com",
            authored_date: `${date}T09:30:00.000Z`,
            web_url: "https://gitlab.example.com/frontend/web/-/commit/ab12cd34",
            type: "feat",
            scope: "auth",
          },
          {
            id: "ef56gh78ij90",
            short_id: "ef56gh78",
            title: "修复列表分页越界",
            message: "fix(list): 修复列表分页越界",
            author_email: "you@example.com",
            authored_date: `${date}T15:10:00.000Z`,
            web_url: "https://gitlab.example.com/frontend/web/-/commit/ef56gh78",
            type: "fix",
            scope: "list",
          },
        ],
      },
    ],
  };

  try {
    const content = renderTemplate(parsed.body, ctx);
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json(
      { content: "", error: e?.message || String(e) },
      { status: 200 }
    );
  }
});
