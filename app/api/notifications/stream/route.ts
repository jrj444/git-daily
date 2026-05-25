import { prisma } from "@/lib/prisma";
import { createSubscriber } from "@/lib/redis";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const channel = `notifications:${user.id}`;
  const sub = createSubscriber();
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat so the connection is established
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      // Subscribe to the user's notification channel
      sub.subscribe(channel).catch(() => {});

      sub.on("message", async (_ch: string, message: string) => {
        if (closed) return;
        try {
          const notification = JSON.parse(message);
          const unreadCount = await prisma.notification.count({
            where: { userId: user.id, read: false },
          });
          const payload = JSON.stringify({
            unreadCount,
            latest: [notification],
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // ignore errors on closed connections
        }
      });

      // Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        sub.unsubscribe(channel).catch(() => {});
        sub.quit().catch(() => {});
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
