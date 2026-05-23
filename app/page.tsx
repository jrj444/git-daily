import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { ReportEditor } from "@/components/report-editor";
import { WeeklyStats } from "@/components/weekly-stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        <ReportEditor />
        <WeeklyStats />
      </main>
    </div>
  );
}
