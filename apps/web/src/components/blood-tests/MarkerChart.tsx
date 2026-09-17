"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatDateShort } from "@ai-cancer-project/shared";

interface MarkerDataPoint {
  date: string;
  value: number;
  referenceMin?: number;
  referenceMax?: number;
}

interface MarkerChartProps {
  markerName: string;
  unit: string;
  data: MarkerDataPoint[];
  referenceMin?: number;
  referenceMax?: number;
}

function toTimestamp(date: string): number {
  // Prefer date-only as UTC noon to avoid TZ day-shifts for YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (m) {
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const t = new Date(date).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function MarkerChart({ markerName, unit, data, referenceMin, referenceMax }: MarkerChartProps) {
  const chartData = [...data]
    .map((d) => ({
      t: toTimestamp(d.date),
      dateLabel: formatDateShort(d.date),
      value: d.value,
    }))
    .filter((d) => d.t > 0)
    .sort((a, b) => a.t - b.t);

  const allValues = chartData.map((d) => d.value);
  const minVal = Math.min(...allValues, referenceMin ?? Infinity);
  const maxVal = Math.max(...allValues, referenceMax ?? -Infinity);
  const padding = (maxVal - minVal) * 0.2 || 1;

  const times = chartData.map((d) => d.t);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  // Small padding so first/last dots aren't clipped; equal span → ~1 week pad
  const tPad = tMax === tMin ? 7 * 24 * 60 * 60 * 1000 : (tMax - tMin) * 0.04;

  if (chartData.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700">
          {markerName} <span className="text-slate-400 font-normal">({unit})</span>
        </h4>
        <p className="text-xs text-slate-400 py-8 text-center">No dated values to chart</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-700">
        {markerName} <span className="text-slate-400 font-normal">({unit})</span>
      </h4>
      <ResponsiveContainer width="100%" height={200}>
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
            domain={[Math.max(0, minVal - padding), maxVal + padding]}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            labelFormatter={(_label, payload) =>
              (payload?.[0]?.payload as { dateLabel?: string } | undefined)?.dateLabel ?? ""
            }
            formatter={(v: number) => [`${v} ${unit}`, markerName]}
          />
          {referenceMin !== undefined && (
            <ReferenceLine
              y={referenceMin}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label={{ value: `Min ${referenceMin}`, position: "insideTopLeft", fontSize: 10, fill: "#f59e0b" }}
            />
          )}
          {referenceMax !== undefined && (
            <ReferenceLine
              y={referenceMax}
              stroke="#ef4444"
              strokeDasharray="4 2"
              label={{ value: `Max ${referenceMax}`, position: "insideTopLeft", fontSize: 10, fill: "#ef4444" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#3b82f6" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
