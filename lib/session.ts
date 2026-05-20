import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export type SessionUser = {
  id: string;
  username: string;
  role: "MEMBER" | "ADMIN";
};

/** Returns the session user or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    role: session.user.role,
  };
}

/** Throws a 401 NextResponse when no session, otherwise returns user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

/** Wraps a route handler, converting thrown NextResponses into responses. */
export function withErrors<T extends (...a: any[]) => Promise<Response>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (e: any) {
      if (e instanceof Response) return e;
      console.error("[api error]", e);
      return NextResponse.json(
        { error: e?.message || "Internal Server Error" },
        { status: 500 }
      );
    }
  }) as T;
}
