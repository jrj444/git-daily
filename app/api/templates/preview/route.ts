import { NextResponse } from "next/server";
import { z } from "zod";
import dayjs from "dayjs";
import { withErrors, requireUser } from "@/lib/session";
import {
  buildPromptMessages,
  formatCommitsForPrompt,
  type ReportContext,
} from "@/lib/report";
import { callLLM } from "@/lib/llm";

const Body = z.object({
  body: z.string().min(1, "提示词内容不能为空"),
});

export const POST = withErrors(async (req: Request) => {
  await requireUser();
  const parsed = Body.parse(await req.json());

  const date = dayjs().format("YYYY-MM-DD");
  const ctx: ReportContext = {
    date,
    total: 2,
    user: { displayName: "示例开发者", email: "developer@example.com" },
    projects: [
      {
        idx: 1,
        name: "平云商城",
        webUrl: "https://gitlab.example.com/mall",
        commits: [
          {
            id: "ab12cd34ef56",
            short_id: "ab12cd34",
            title: "图标体系收敛为 common iconfont，移除 TDesign 字体",
            message: "feat: 图标体系收敛为 common iconfont，移除 TDesign 字体",
            author_email: "developer@example.com",
            authored_date: `${date}T09:30:00.000Z`,
            web_url: "https://gitlab.example.com/mall/-/commit/ab12cd34",
            type: "feat",
            scope: "ui",
          },
          {
            id: "ef56gh78ij90",
            short_id: "ef56gh78",
            title: "后台列表页统一为搜索卡加列表卡结构，表格补外框",
            message: "feat: 后台列表页统一为搜索卡加列表卡结构，表格补外框",
            author_email: "developer@example.com",
            authored_date: `${date}T15:10:00.000Z`,
            web_url: "https://gitlab.example.com/mall/-/commit/ef56gh78",
            type: "feat",
            scope: "list",
          },
        ],
      },
    ],
  };

  try {
    const messages = buildPromptMessages(parsed.body, ctx);
    let content = "";
    try {
      content = await callLLM(messages);
    } catch {
      content = `[提示词预览模式]\n\n--- 实际发送给大模型的内容 ---\n${messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n")}`;
    }
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json(
      { content: "", error: e?.message || String(e) },
      { status: 200 }
    );
  }
});
