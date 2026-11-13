export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callLLM(
  messages: LLMMessage[],
  options?: { temperature?: number }
): Promise<string> {
  const base = process.env.LLM_API_BASE || "https://api.deepseek.com";
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "deepseek-flash";

  if (!key) {
    throw new Error("未配置 LLM_API_KEY，请在 .env 中配置");
  }

  const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: options?.temperature ?? 0.3,
      messages,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`LLM 接口响应异常 (${res.status}): ${t || res.statusText}`);
  }

  const data = await res.json();
  let content: string = data?.choices?.[0]?.message?.content?.trim?.() || "";
  if (!content) {
    throw new Error("LLM 返回内容为空");
  }

  // Strip markdown code block wrapping if LLM included it
  if (content.startsWith("```markdown")) {
    content = content.replace(/^```markdown\s*/, "").replace(/\s*```$/, "").trim();
  } else if (content.startsWith("```")) {
    content = content.replace(/^```\w*\s*/, "").replace(/\s*```$/, "").trim();
  }

  return content;
}
