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
  Legend,
} from "recharts";
import { formatDateShort } from "@cancer-monitor/shared";

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

export function MarkerChart({ markerName, unit, data, referenceMin, referenceMax }: MarkerChartProps) {
  const chartData = data.map((d) => ({
    date: formatDateShort(d.date),
    value: d.value,
  }));

  const allValues = data.map((d) => d.value);
  const minVal = Math.min(...allValues, referenceMin ?? Infinity);
  const maxVal = Math.max(...allValues, referenceMax ?? -Infinity);
  const padding = (maxVal - minVal) * 0.2 || 1;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-700">
        {markerName} <span className="text-slate-400 font-normal">({unit})</span>
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis
            domain={[Math.max(0, minVal - padding), maxVal + padding]}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
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
