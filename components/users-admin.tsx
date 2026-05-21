"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "MEMBER" | "ADMIN";
  gitlabBaseUrl: string | null;
  gitlabEmail: string | null;
  createdAt: string;
};

export function UsersAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");

  async function reload() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function create() {
    if (!username || !displayName || !password) {
      toast.error("请填写完整");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data?.error || "创建失败");
      return;
    }
    toast.success("已创建");
    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("MEMBER");
    void reload();
  }

  async function resetPwd(u: UserRow) {
    const pw = prompt(`为 ${u.username} 设置新密码（至少 6 位）`);
    if (!pw) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, password: pw }),
    });
    if (res.ok) toast.success("已重置密码");
    else toast.error("失败");
  }

  async function changeRole(u: UserRow, r: "MEMBER" | "ADMIN") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role: r }),
    });
    if (res.ok) {
      toast.success("已更新");
      void reload();
    }
  }

  async function del(u: UserRow) {
    if (!confirm(`删除用户 ${u.username}？该用户的日报与配置一并删除`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("已删除");
      void reload();
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">新建用户</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          <input
            className="border border-border rounded px-2 py-1.5 text-sm"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="border border-border rounded px-2 py-1.5 text-sm"
            placeholder="显示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input
            type="password"
            className="border border-border rounded px-2 py-1.5 text-sm"
            placeholder="初始密码（≥6 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="border border-border rounded px-2 py-1.5 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="MEMBER">普通成员</option>
            <option value="ADMIN">管理员</option>
          </select>
        </div>
        <button
          onClick={create}
          className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground"
        >
          创建
        </button>
      </section>

      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">用户名</th>
              <th className="px-3 py-2">显示名</th>
              <th className="px-3 py-2">角色</th>
              <th className="px-3 py-2">GitLab 邮箱</th>
              <th className="px-3 py-2">创建时间</th>
              <th className="px-3 py-2 w-1">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">{u.username}</td>
                <td className="px-3 py-2">{u.displayName}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      changeRole(u, e.target.value as "MEMBER" | "ADMIN")
                    }
                    className="border border-border rounded px-1 py-0.5 text-xs"
                  >
                    <option value="MEMBER">成员</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {u.gitlabEmail || "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    onClick={() => resetPwd(u)}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-muted mr-1"
                  >
                    重置密码
                  </button>
                  <button
                    onClick={() => del(u)}
                    className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
