"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { DailyPoint } from "@/components/stats-content";

export function TrendChart({ data }: { data: DailyPoint[] }) {
  // Format date as MM-DD for X axis
  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(5), // "MM-DD"
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h2 className="font-medium mb-3">每日提交趋势</h2>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              width={30}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                fontSize: "12px",
              }}
              labelFormatter={(label) => `日期: ${label}`}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            />
            <Area
              type="monotone"
              dataKey="feat"
              name="需求/功能"
              stackId="1"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="fix"
              name="Bug 修复"
              stackId="1"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="refactor"
              name="重构"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="other"
              name="其他"
              stackId="1"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
