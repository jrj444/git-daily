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
          <h1 className="text-xl font-semibold">模板管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            编辑日报模板（基于 Handlebars 语法）。可在右侧查看可用占位符并预览效果。
          </p>
        </div>
        <TemplatesManager />
      </main>
    </div>
  );
}
