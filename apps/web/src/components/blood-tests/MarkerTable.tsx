"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { markerStatusColor, markerStatusBg } from "@cancer-monitor/shared";
import type { BloodMarker, MarkerStatus } from "@cancer-monitor/shared";

interface MarkerTableProps {
  markers: BloodMarker[];
}

const statusLabels: Record<MarkerStatus, string> = {
  normal: "Normal",
  low: "Low",
  high: "High",
  critical_low: "Critical Low",
  critical_high: "Critical High",
};

export function MarkerTable({ markers }: MarkerTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-slate-500 font-medium">Marker</th>
            <th className="text-right py-2 px-3 text-slate-500 font-medium">Value</th>
            <th className="text-right py-2 px-3 text-slate-500 font-medium">Reference</th>
            <th className="text-center py-2 px-3 text-slate-500 font-medium">Status</th>
            <th className="text-left py-2 px-3 text-slate-500 font-medium">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {markers.map((marker) => (
            <tr key={marker.name} className="hover:bg-slate-50 transition-colors">
              <td className="py-2.5 px-3 font-medium text-slate-800">{marker.name}</td>
              <td className={cn("py-2.5 px-3 text-right font-mono font-semibold", markerStatusColor(marker.status))}>
                {marker.value} <span className="text-slate-400 font-normal text-xs">{marker.unit}</span>
              </td>
              <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-xs">
                {marker.referenceMin !== undefined || marker.referenceMax !== undefined
                  ? `${marker.referenceMin ?? "–"} – ${marker.referenceMax ?? "–"} ${marker.unit}`
                  : "–"}
              </td>
              <td className="py-2.5 px-3">
                <div className="flex justify-center">
                  <span className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-xs font-medium border",
                    markerStatusBg(marker.status),
                    markerStatusColor(marker.status)
                  )}>
                    {statusLabels[marker.status]}
                  </span>
                </div>
              </td>
              <td className="py-2.5 px-3">
                <TrendIcon trend={marker.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === "increasing") return <span className="flex items-center gap-1 text-orange-500 text-xs"><TrendingUp className="w-3.5 h-3.5" /> Rising</span>;
  if (trend === "decreasing") return <span className="flex items-center gap-1 text-green-600 text-xs"><TrendingDown className="w-3.5 h-3.5" /> Falling</span>;
  if (trend === "stable") return <span className="flex items-center gap-1 text-slate-500 text-xs"><Minus className="w-3.5 h-3.5" /> Stable</span>;
  return <span className="text-slate-300 text-xs">–</span>;
}
