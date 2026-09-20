"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatDateShort } from "@ai-cancer-project/shared";

interface BpPoint {
  date: string;
  systolic: number;
  diastolic: number;
}

function toTimestamp(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function BloodPressureChart({ data }: { data: BpPoint[] }) {
  const chartData = [...data]
    .map((d) => ({
      t: toTimestamp(d.date),
      dateLabel: formatDateShort(d.date),
      systolic: d.systolic,
      diastolic: d.diastolic,
    }))
    .filter((d) => d.t > 0)
    .sort((a, b) => a.t - b.t);

  if (chartData.length === 0) {
    return <p className="text-xs text-slate-400 py-8 text-center">No blood pressure readings yet</p>;
  }

  const times = chartData.map((d) => d.t);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tPad = tMax === tMin ? 7 * 24 * 60 * 60 * 1000 : (tMax - tMin) * 0.04;

  const vals = chartData.flatMap((d) => [d.systolic, d.diastolic]);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const pad = (maxVal - minVal) * 0.15 || 10;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-700">
        Blood pressure <span className="text-slate-400 font-normal">(mmHg)</span>
      </h4>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[tMin - tPad, tMax + tPad]}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(t: number) => formatDateShort(new Date(t).toISOString().slice(0, 10))}
            tickCount={Math.min(6, Math.max(2, chartData.length))}
          />
          <YAxis
            domain={[Math.max(0, minVal - pad), maxVal + pad]}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            labelFormatter={(_l, payload) =>
              (payload?.[0]?.payload as { dateLabel?: string } | undefined)?.dateLabel ?? ""
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="systolic"
            name="Systolic (high)"
            stroke="#dc2626"
            strokeWidth={2}
            dot={{ r: 4, fill: "#dc2626" }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            name="Diastolic (low)"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4, fill: "#2563eb" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
