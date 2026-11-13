import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { ProjectsManager } from "@/components/projects-manager";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">项目管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理业务项目及关联的代码仓库（一个项目可纳管多个前端、移动端或服务端代码仓），支持日常事项按项目挂载与智能汇报。
          </p>
        </div>
        <ProjectsManager />
      </main>
    </div>
  );
}
