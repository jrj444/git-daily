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
            管理你的 GitLab 项目列表，启用日报抓取的项目。无需的项目可以删除以保持列表整洁。
          </p>
        </div>
        <ProjectsManager />
      </main>
    </div>
  );
}
