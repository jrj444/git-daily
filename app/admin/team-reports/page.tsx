import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { TeamReports } from "@/components/team-reports";

export const dynamic = "force-dynamic";

export default async function TeamReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-4">团队日报</h1>
        <TeamReports />
      </main>
    </div>
  );
}
