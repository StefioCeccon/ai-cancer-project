"use client";

import { useState } from "react";
import {
  Sparkles, Target, Cpu, AlertTriangle,
  ChevronDown, ChevronUp, CheckCircle2, X, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { AnalysisType } from "@ai-cancer-project/shared";

export interface StrategyRecommendation {
  recommendedModels: string[];
  focusAreas: string[];
  rationale: string;
  analysisTier: "model_only" | "model_ai";
  promptContext: string;
  dominantModality: string | null;
  warningFlags: string[];
  recommendedAnalysisType: AnalysisType;
  imagingPriority: "high" | "medium" | "low" | "none";
}

interface Props {
  strategy: StrategyRecommendation | null;
  loading: boolean;
  onApply: (strategy: StrategyRecommendation) => void;
  onRefresh: () => void;
}

const tierLabels = {
  model_only: "ML Model output only (free)",
  model_ai: "ML Model → AI on flagged slices",
};

const tierColors = {
  model_only: "bg-teal-50 text-teal-700 border-teal-200",
  model_ai: "bg-blue-50 text-blue-700 border-blue-200",
};

const priorityColors = {
  high: "text-red-600",
  medium: "text-orange-500",
  low: "text-slate-500",
  none: "text-slate-400",
};

export function StrategyCard({ strategy, loading, onApply, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (loading) {
    return (
      <div className="border border-blue-200 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <div className="h-3.5 bg-blue-200 rounded w-40" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-blue-100 rounded w-full" />
          <div className="h-3 bg-blue-100 rounded w-3/4" />
          <div className="h-3 bg-blue-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!strategy) return null;

  return (
    <div className="border border-blue-200 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">AI-Recommended Strategy</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Based on patient profile · {strategy.dominantModality ?? "Mixed"} focus
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRefresh}
            title="Regenerate strategy"
            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            title="Dismiss"
            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Warning flags */}
        {strategy.warningFlags.length > 0 && (
          <div className="space-y-1">
            {strategy.warningFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">{flag}</p>
              </div>
            ))}
          </div>
        )}

        {/* ML Models */}
        {strategy.recommendedModels.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-800">Recommended ML Models</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {strategy.recommendedModels.map((m) => (
                <span key={m} className="px-2 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-lg font-medium shadow-sm">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Focus areas */}
        {strategy.focusAreas.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-blue-800">Focus Areas</span>
              {strategy.imagingPriority !== "none" && (
                <span className={cn("text-xs font-medium ml-auto", priorityColors[strategy.imagingPriority])}>
                  {strategy.imagingPriority} imaging priority
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {strategy.focusAreas.map((area) => (
                <span key={area} className="px-2 py-1 bg-white/70 border border-blue-100 text-slate-700 text-xs rounded-lg">
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Analysis tier */}
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium", tierColors[strategy.analysisTier])}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{tierLabels[strategy.analysisTier]}</span>
        </div>

        {/* Rationale — expandable */}
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide rationale" : "Show rationale"}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-700 leading-relaxed bg-white/60 rounded-lg p-3 border border-blue-100">
                {strategy.rationale}
              </p>
              {strategy.promptContext && (
                <div className="bg-white/60 rounded-lg p-3 border border-blue-100">
                  <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-1">Clinical Context for AI</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{strategy.promptContext}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Apply button */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onApply(strategy)}
            className="flex-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Apply Strategy
          </Button>
          <Badge variant="info" className="text-[10px] shrink-0">
            {strategy.recommendedAnalysisType.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>
    </div>
  );
}
