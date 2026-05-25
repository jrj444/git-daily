import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";

export const GET = withErrors(async (req: Request) => {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
});

const PatchBody = z.union([
  z.object({ ids: z.array(z.string().min(1)) }),
  z.object({ all: z.literal(true) }),
]);

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PatchBody.parse(await req.json());

  if ("all" in body) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
});
