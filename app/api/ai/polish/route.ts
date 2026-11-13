import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrors, requireUser } from "@/lib/session";
import { callLLM } from "@/lib/llm";

const Body = z.object({
  content: z.string().min(1).max(20000),
  language: z.string().optional(),
});

export const POST = withErrors(async (req: Request) => {
  await requireUser();
  const body = Body.parse(await req.json());

  const lang = body.language || "中文";
  const system =
    `你是一名前端/全栈开发工程师的贴心助手，负责把提供的工作内容或 git commit 列表整理并润色成规范、专业、简洁的${lang}企业工作日报。\n\n` +
    `输出必须严格遵循以下四段式结构，标题与格式保持一致：\n\n` +
    `今日计划完成工作:\n` +
    `1. <项目名> - <高阶概括，如迭代优化、需求开发>\n\n` +
    `今日实际完成工作:\n` +
    `<项目名>\n` +
    `<按项目陈列专业工作要点，每条不超过35字，纯文本换行展示，不带无意义的提交hash/前缀，条目精炼客观>\n\n` +
    `未完成工作及原因:\n` +
    `无\n\n` +
    `明日工作计划:\n` +
    `1. <项目名> - <后续推进任务，如优化迭代、联调测试>\n\n` +
    `具体要求：\n` +
    `1. 基于提供的内容进行归纳整理，严禁编造凭空捏造未提到的项目。\n` +
    `2. “今日实际完成工作”中：按项目分组，语言精炼专业（如“统一列表卡片结构，移除冗余样式”、“修复某某边界异常”），每个项目下列出具体要点，纯净换行，不要带“- ”或数字编号。\n` +
    `3. “未完成工作及原因”：若用户原始内容中有明确提到未完成事项或原因，请保留并润色；若未提及或写着“无”，则统一输出“无”。\n` +
    `4. “今日计划完成工作”与“明日工作计划”：根据涉及的项目，提炼出清晰简短的项目级目标（如“1. 平云商城 - 迭代优化”）。\n` +
    `5. 仅输出最终文本，禁止附带任何问候语、开场白、代码块反引号（\`\`\`）或解释说明。`;

  try {
    const polished = await callLLM([
      { role: "system", content: system },
      { role: "user", content: body.content },
    ]);
    return NextResponse.json({ content: polished });
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI 润色失败: ${e?.message || e}` },
      { status: 502 }
    );
  }
});
