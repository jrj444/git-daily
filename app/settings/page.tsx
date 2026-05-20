import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-4">设置</h1>
        <SettingsForm />
      </main>
    </div>
  );
}
