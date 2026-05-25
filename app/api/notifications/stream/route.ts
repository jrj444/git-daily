import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let lastCheck = new Date();
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const newNotifs = await prisma.notification.findMany({
            where: { userId: user.id, createdAt: { gt: lastCheck } },
            orderBy: { createdAt: "desc" },
            take: 10,
          });
          if (newNotifs.length > 0) {
            lastCheck = new Date();
            const unreadCount = await prisma.notification.count({
              where: { userId: user.id, read: false },
            });
            const payload = JSON.stringify({ unreadCount, latest: newNotifs });
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
        } catch {
          // Connection may have closed
        }
      }, 3000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
