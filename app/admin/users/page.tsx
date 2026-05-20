import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";
import { UsersAdmin } from "@/components/users-admin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  return (
    <div className="min-h-screen flex flex-col">
      <Nav user={user} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-4">用户管理</h1>
        <UsersAdmin />
      </main>
    </div>
  );
}
