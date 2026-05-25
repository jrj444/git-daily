"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read: boolean;
  relatedId?: string | null;
  createdAt: string;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  // Initial fetch
  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setUnreadCount(data.unreadCount ?? 0);
        if (data.latest && data.latest.length > 0) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newItems = data.latest.filter(
              (n: NotificationItem) => !existingIds.has(n.id)
            );
            return [...newItems, ...prev].slice(0, 30);
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  const markAsRead = useCallback(async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - ids.length));
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markAsRead, markAllRead };
}
