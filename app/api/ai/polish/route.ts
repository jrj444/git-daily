import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrors, requireUser } from "@/lib/session";

const Body = z.object({
  content: z.string().min(1).max(20000),
  language: z.string().optional(),
});

export const POST = withErrors(async (req: Request) => {
  await requireUser();
  const body = Body.parse(await req.json());

  const base = process.env.LLM_API_BASE;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  if (!base || !key) {
    return NextResponse.json(
      { error: "未配置 LLM_API_BASE / LLM_API_KEY" },
      { status: 400 }
    );
  }

  const lang = body.language || "中文";
  const system =
    `你是一名前端工程师的助手，负责把 git commit 列表润色成简洁、可读的${lang}日报。\n` +
    `要求：\n` +
    `1. 仅基于提供的内容总结，禁止编造未提到的工作。\n` +
    `2. 按项目分组，每组使用要点列表，每条不超过 30 字。\n` +
    `3. 保留 markdown 标题层级；输出最终 markdown 即可，不要解释。`;

  const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: body.content },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `LLM ${res.status}: ${t || res.statusText}` },
      { status: 502 }
    );
  }
  const data = await res.json();
  const polished: string =
    data?.choices?.[0]?.message?.content?.trim?.() || "";
  if (!polished) {
    return NextResponse.json({ error: "LLM 返回为空" }, { status: 502 });
  }
  return NextResponse.json({ content: polished });
});
