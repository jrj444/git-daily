import { prisma } from "@/lib/prisma";
import { getPublisher } from "@/lib/redis";

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  relatedId?: string;
};

/**
 * Creates a notification in the database and publishes it to Redis
 * so that connected SSE clients receive it instantly.
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({ data: input });
  const pub = getPublisher();
  await pub.publish(
    `notifications:${input.userId}`,
    JSON.stringify(notification)
  );
  return notification;
}
