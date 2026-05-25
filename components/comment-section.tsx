"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string };
};

type Props = {
  reportId: string;
  currentUserId?: string;
  isAdmin?: boolean;
};

export function CommentSection({ reportId, currentUserId, isAdmin }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?reportId=${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      // silent
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    const content = input.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "评论失败");
        return;
      }
      setInput("");
      void load();
    } catch {
      toast.error("网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除这条评论？")) return;
    const res = await fetch(`/api/comments?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      toast.error("删除失败");
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="border-t border-border pt-3 mt-3">
      <h4 className="text-sm font-medium mb-2">
        评论 {comments.length > 0 && `(${comments.length})`}
      </h4>

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground mb-3">暂无评论</p>
      )}

      <div className="space-y-2 mb-3">
        {comments.map((c) => (
          <div
            key={c.id}
            className="flex gap-2 text-sm group"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
              {c.author.displayName.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs">
                  {c.author.displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(c.createdAt)}
                </span>
                {(c.author.id === currentUserId || isAdmin) && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  >
                    删除
                  </button>
                )}
              </div>
              <p className="text-sm mt-0.5 break-words">{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="写评论…"
          className="flex-1 border border-border rounded px-2 py-1.5 text-sm"
          maxLength={2000}
        />
        <button
          onClick={() => void submit()}
          disabled={submitting || !input.trim()}
          className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
}
