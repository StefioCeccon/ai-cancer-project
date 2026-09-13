"use client";

import { useMemo } from "react";
import {
  FileText, Droplets, Scan, AlertTriangle, Check, Plus, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@cancer-monitor/shared";
import type { AnalysisType } from "@cancer-monitor/shared";
import {
  estimateAnalysisContext,
  estimateItemTokens,
  type ReportContextItem,
  type BloodTestContextItem,
  type ImagingContextItem,
  type ContextUsageLevel,
} from "@/lib/ai/contextEstimate";

interface AnalysisContextSelectorProps {
  analysisType: AnalysisType;
  model: string;
  strategyContext?: string;
  reports: ReportContextItem[];
  bloodTests: BloodTestContextItem[];
  imagingStudies: ImagingContextItem[];
  selectedReportIds: string[];
  selectedBloodTestIds: string[];
  selectedImagingIds: string[];
  onToggleReport: (id: string) => void;
  onToggleBloodTest: (id: string) => void;
  onToggleImaging: (id: string) => void;
  onSelectAllReports: () => void;
  onDeselectAllReports: () => void;
  onSelectAllBloodTests: () => void;
  onDeselectAllBloodTests: () => void;
  onSelectAllImaging: () => void;
  onDeselectAllImaging: () => void;
  readOnly?: boolean;
}

const reportTypeLabels: Record<string, string> = {
  visit_note: "Visit Note",
  pathology: "Pathology",
  radiology: "Radiology",
  discharge_summary: "Discharge",
  treatment_plan: "Treatment Plan",
  prescription: "Prescription",
  referral: "Referral",
  other: "Other",
};

const levelStyles: Record<ContextUsageLevel, { bar: string; text: string; bg: string }> = {
  ok: { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50 border-green-200" },
  warning: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  full: { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function ContextUsageBar({
  model,
  analysisType,
  strategyContext,
  selectedReports,
  selectedBloodTests,
  selectedImaging,
}: {
  model: string;
  analysisType: AnalysisType;
  strategyContext?: string;
  selectedReports: ReportContextItem[];
  selectedBloodTests: BloodTestContextItem[];
  selectedImaging: ImagingContextItem[];
}) {
  const estimate = useMemo(
    () =>
      estimateAnalysisContext({
        model,
        analysisType,
        reports: selectedReports,
        bloodTests: selectedBloodTests,
        imagingStudies: selectedImaging,
        strategyContext,
      }),
    [model, analysisType, strategyContext, selectedReports, selectedBloodTests, selectedImaging]
  );

  const styles = levelStyles[estimate.level];
  const windowLabel =
    estimate.contextWindow >= 1_000_000
      ? `${(estimate.contextWindow / 1_000_000).toFixed(1)}M`
      : `${Math.round(estimate.contextWindow / 1000)}K`;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", styles.bg)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-700">Context usage</span>
        <span className={cn("text-xs font-semibold", styles.text)}>
          ~{estimate.estimatedTokens.toLocaleString()} / {estimate.usableTokens.toLocaleString()} tokens ({estimate.usagePercent}%)
        </span>
      </div>
      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", styles.bar)}
          style={{ width: `${Math.min(estimate.usagePercent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Model window: {windowLabel} · Output reserved: 8K tokens
      </p>
      {estimate.level === "warning" && (
        <p className="text-xs text-amber-700 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Context is getting large. Consider removing some reports or studies before running.
        </p>
      )}
      {estimate.level === "full" && (
        <p className="text-xs text-red-700 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Context may exceed the model limit. Remove items or switch to a model with a larger window.
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  count,
  selectedCount,
  readOnly,
  onSelectAll,
  onDeselectAll,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  selectedCount: number;
  readOnly?: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {icon}
        {label}
        <span className="text-xs font-normal text-slate-400">
          {readOnly ? `${selectedCount} included` : `${selectedCount}/${count} selected`}
        </span>
      </div>
      {!readOnly && count > 0 && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5"
          >
            All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-xs text-slate-500 hover:text-slate-700 px-1.5 py-0.5"
          >
            None
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  included,
  readOnly,
  onToggle,
  children,
}: {
  included: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (readOnly) {
    if (!included) return null;
    return (
      <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
        <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-colors",
        included
          ? "border-blue-200 bg-blue-50/50 hover:bg-blue-50"
          : "border-slate-200 bg-white hover:border-slate-300 opacity-60"
      )}
    >
      <span className={cn(
        "mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border",
        included ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
      )}>
        {included ? <Check className="w-2.5 h-2.5" /> : null}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
      {!included ? (
        <Plus className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
      ) : (
        <Minus className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
      )}
    </button>
  );
}

export function AnalysisContextSelector({
  analysisType,
  model,
  strategyContext,
  reports,
  bloodTests,
  imagingStudies,
  selectedReportIds,
  selectedBloodTestIds,
  selectedImagingIds,
  onToggleReport,
  onToggleBloodTest,
  onToggleImaging,
  onSelectAllReports,
  onDeselectAllReports,
  onSelectAllBloodTests,
  onDeselectAllBloodTests,
  onSelectAllImaging,
  onDeselectAllImaging,
  readOnly = false,
}: AnalysisContextSelectorProps) {
  const skipClinical = analysisType === "ml_imaging";

  const selectedReports = reports.filter((r) => selectedReportIds.includes(r.id));
  const selectedBloodTests = bloodTests.filter((b) => selectedBloodTestIds.includes(b.id));
  const selectedImaging = imagingStudies.filter((s) => selectedImagingIds.includes(s.id));

  const visibleReports = readOnly ? selectedReports : reports;
  const visibleBloodTests = readOnly ? selectedBloodTests : bloodTests;
  const visibleImaging = readOnly ? selectedImaging : imagingStudies;

  const totalSelected =
    (skipClinical ? 0 : selectedReportIds.length + selectedBloodTestIds.length) +
    selectedImagingIds.length;

  return (
    <div className="space-y-4">
      <ContextUsageBar
        model={model}
        analysisType={analysisType}
        strategyContext={strategyContext}
        selectedReports={skipClinical ? [] : selectedReports}
        selectedBloodTests={skipClinical ? [] : selectedBloodTests}
        selectedImaging={selectedImaging}
      />

      {readOnly && totalSelected === 0 && (
        <p className="text-xs text-slate-500">No input data was recorded for this analysis.</p>
      )}

      {!skipClinical && (
        <div className="space-y-2">
          <SectionHeader
            icon={<FileText className="w-4 h-4 text-purple-600" />}
            label="Reports"
            count={reports.length}
            selectedCount={selectedReportIds.length}
            readOnly={readOnly}
            onSelectAll={onSelectAllReports}
            onDeselectAll={onDeselectAllReports}
          />
          {visibleReports.length === 0 ? (
            <p className="text-xs text-slate-400 pl-6">
              {readOnly ? "No reports were included." : "No reports on file."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visibleReports.map((report) => {
                const included = selectedReportIds.includes(report.id);
                const tokens = estimateItemTokens("report", report);
                return (
                  <ToggleRow
                    key={report.id}
                    included={included}
                    readOnly={readOnly}
                    onToggle={() => onToggleReport(report.id)}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800 truncate">{report.title}</span>
                      <Badge variant="neutral">{reportTypeLabels[report.reportType] ?? report.reportType}</Badge>
                      <span className="text-xs text-slate-400">~{tokens.toLocaleString()} tok</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(report.reportDate)}
                      {report.author ? ` · ${report.author}` : ""}
                    </p>
                    {report.aiSummary && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{report.aiSummary}</p>
                    )}
                  </ToggleRow>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!skipClinical && (
        <div className="space-y-2">
          <SectionHeader
            icon={<Droplets className="w-4 h-4 text-blue-600" />}
            label="Blood Tests"
            count={bloodTests.length}
            selectedCount={selectedBloodTestIds.length}
            readOnly={readOnly}
            onSelectAll={onSelectAllBloodTests}
            onDeselectAll={onDeselectAllBloodTests}
          />
          {visibleBloodTests.length === 0 ? (
            <p className="text-xs text-slate-400 pl-6">
              {readOnly ? "No blood tests were included." : "No blood tests on file."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visibleBloodTests.map((test) => {
                const included = selectedBloodTestIds.includes(test.id);
                const tokens = estimateItemTokens("bloodTest", test);
                return (
                  <ToggleRow
                    key={test.id}
                    included={included}
                    readOnly={readOnly}
                    onToggle={() => onToggleBloodTest(test.id)}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800">
                        {formatDate(test.testDate)}
                      </span>
                      {test.labName && <span className="text-xs text-slate-500">{test.labName}</span>}
                      <Badge variant="info">{test.markers.length} markers</Badge>
                      <span className="text-xs text-slate-400">~{tokens.toLocaleString()} tok</span>
                    </div>
                  </ToggleRow>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <SectionHeader
          icon={<Scan className="w-4 h-4 text-teal-600" />}
          label="Imaging Studies"
          count={imagingStudies.length}
          selectedCount={selectedImagingIds.length}
          readOnly={readOnly}
          onSelectAll={onSelectAllImaging}
          onDeselectAll={onDeselectAllImaging}
        />
        {visibleImaging.length === 0 ? (
          <p className="text-xs text-slate-400 pl-6">
            {readOnly ? "No imaging studies were included." : "No imaging studies on file."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {visibleImaging.map((study) => {
              const included = selectedImagingIds.includes(study.id);
              const tokens = estimateItemTokens("imaging", study);
              const hasMl = Boolean(study.mlModelResults?.sybil || study.aiFindings);
              return (
                <ToggleRow
                  key={study.id}
                  included={included}
                  readOnly={readOnly}
                  onToggle={() => onToggleImaging(study.id)}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">
                      {study.modality} — {study.bodyPart}
                    </span>
                    {hasMl && <Badge variant="info">ML data</Badge>}
                    <span className="text-xs text-slate-400">~{tokens.toLocaleString()} tok</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDate(study.studyDate)}</p>
                </ToggleRow>
              );
            })}
          </div>
        )}
      </div>

      {skipClinical && !readOnly && (
        <p className="text-xs text-slate-500">
          ML Imaging analysis uses imaging studies only — reports and blood tests are excluded.
        </p>
      )}
    </div>
  );
}

export { estimateAnalysisContext };
