import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { TemplatesManager } from "@/components/templates-manager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">AI 提示词管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置日报 AI 生成提示词（Prompt）。大模型将根据设定的提示词与 Git 提交记录自动提炼并输出规范日报。
          </p>
        </div>
        <TemplatesManager />
      </main>
    </div>
  );
}
