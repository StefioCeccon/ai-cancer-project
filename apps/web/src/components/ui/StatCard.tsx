import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
  iconColor?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className, iconColor = "text-blue-600" }: StatCardProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
              {trend.value >= 0 ? "+" : ""}{trend.value} {trend.label}
            </p>
          )}
        </div>
        <div className={cn("w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center", iconColor)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
