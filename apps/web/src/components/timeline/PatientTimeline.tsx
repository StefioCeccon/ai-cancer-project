"use client";

import { useMemo, useState, useRef, useCallback, useLayoutEffect } from "react";
import Link from "next/link";
import { formatDate, formatDateShort } from "@cancer-monitor/shared";
import { cn } from "@/lib/utils/cn";
import { ReportTimelineCategoryField } from "@/components/reports/ReportTimelineCategoryField";
import { CATEGORY_COLORS } from "@/lib/timeline/colors";
import type { TimelineCategory, TimelineEvent, TimelineLane } from "@/lib/timeline/types";

const LANE_HEIGHT = 44;
const LABEL_WIDTH = 280;
const CHART_PADDING_X = 48;
const MIN_CHART_WIDTH = 720;

const SEVERITY_COLORS: Record<string, string> = {
  mild: "#f59e0b",
  moderate: "#f97316",
  severe: "#ef4444",
};

const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  blood_test: "Blood Tests",
  imaging: "Imaging",
  report: "Reports",
  symptom: "Symptoms",
  therapy: "Therapies",
};

interface PatientTimelineProps {
  events: TimelineEvent[];
  lanes: TimelineLane[];
  locale: string;
  onReportCategoryChange?: () => void;
}

function parseDateMs(date: string): number {
  const ms = new Date(date).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function monthTicks(minMs: number, maxMs: number): { ms: number; label: string }[] {
  const ticks: { ms: number; label: string }[] = [];
  const start = new Date(minMs);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const cursor = new Date(start);
  while (cursor.getTime() <= maxMs + 86400000 * 31) {
    ticks.push({
      ms: cursor.getTime(),
      label: cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

export function PatientTimeline({ events, lanes, locale, onReportCategoryChange }: PatientTimelineProps) {
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<TimelineCategory>>(new Set());
  const [ongoingOnly, setOngoingOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  const visibleEvents = useMemo(
    () =>
      events.filter((e) => {
        if (hiddenTypes.has(e.typeKey) || hiddenCategories.has(e.category)) return false;
        if (ongoingOnly && (e.category === "symptom" || e.category === "therapy") && e.endDate) return false;
        return true;
      }),
    [events, hiddenTypes, hiddenCategories, ongoingOnly]
  );

  const visibleLanes = useMemo(() => {
    const activeTypeKeys = new Set(visibleEvents.map((e) => e.typeKey));
    return lanes.filter(
      (l) => !hiddenTypes.has(l.typeKey) && !hiddenCategories.has(l.category) && activeTypeKeys.has(l.typeKey)
    );
  }, [lanes, hiddenTypes, hiddenCategories, visibleEvents]);

  const laneIndex = useMemo(() => {
    const map = new Map<string, number>();
    visibleLanes.forEach((l, i) => map.set(l.typeKey, i));
    return map;
  }, [visibleLanes]);

  const { minMs, maxMs, chartWidth } = useMemo(() => {
    const now = Date.now();
    if (visibleEvents.length === 0) {
      return { minMs: now - 86400000 * 180, maxMs: now, chartWidth: MIN_CHART_WIDTH };
    }
    const times = visibleEvents.flatMap((e) => {
      const start = parseDateMs(e.date);
      const end = e.endDate ? parseDateMs(e.endDate) : start;
      return [start, end];
    });
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(max - min, 86400000 * 30);
    const pad = span * 0.08;
    const minMs = min - pad;
    const maxMs = Math.max(max + pad, now);
    const days = (maxMs - minMs) / 86400000;
    const chartWidth = Math.max(MIN_CHART_WIDTH, Math.ceil(days * 4) + CHART_PADDING_X * 2);
    return { minMs, maxMs, chartWidth };
  }, [visibleEvents]);

  const xFor = useCallback(
    (date: string) => {
      const ms = parseDateMs(date);
      const span = maxMs - minMs || 1;
      const ratio = (ms - minMs) / span;
      return CHART_PADDING_X + ratio * (chartWidth - CHART_PADDING_X * 2);
    },
    [minMs, maxMs, chartWidth]
  );

  const ticks = useMemo(() => monthTicks(minMs, maxMs), [minMs, maxMs]);
  const chartHeight = Math.max(visibleLanes.length, 1) * LANE_HEIGHT + 56;
  const selected = visibleEvents.find((e) => e.id === selectedId) ?? events.find((e) => e.id === selectedId);
  const hovered = visibleEvents.find((e) => e.id === hoveredId);

  useLayoutEffect(() => {
    if (didInitialScroll.current) return;
    const el = scrollRef.current;
    if (!el || chartWidth <= el.clientWidth) return;

    const today = new Date().toISOString().slice(0, 10);
    const todayX = xFor(today);
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = Math.max(0, Math.min(todayX - el.clientWidth * 0.65, maxScroll));
    el.scrollLeft = target;
    didInitialScroll.current = true;
  }, [chartWidth, xFor]);

  function toggleType(typeKey: string) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeKey)) next.delete(typeKey);
      else next.add(typeKey);
      return next;
    });
  }

  function toggleCategory(cat: TimelineCategory) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <p className="text-center text-slate-500 text-sm py-12">
        No clinical data yet for this patient.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category + type filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {(Object.keys(CATEGORY_LABELS) as TimelineCategory[]).map((cat) => {
          const on = !hiddenCategories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                on
                  ? "bg-white border-slate-200 text-slate-800 shadow-sm"
                  : "bg-slate-100 border-transparent text-slate-400 line-through"
              )}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => setOngoingOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
            ongoingOnly
              ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
              : "bg-white border-slate-200 text-slate-600 shadow-sm"
          )}
        >
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", ongoingOnly ? "bg-amber-400" : "bg-slate-300")} />
          Ongoing only
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {lanes.map((lane) => {
          const manuallyOff = hiddenTypes.has(lane.typeKey) || hiddenCategories.has(lane.category);
          // A lane is suppressed by the ongoing filter if ongoingOnly is on, the lane
          // belongs to a filterable category, and none of its events are ongoing.
          const hiddenByOngoing =
            ongoingOnly &&
            (lane.category === "symptom" || lane.category === "therapy") &&
            !manuallyOff &&
            !events.some((e) => e.typeKey === lane.typeKey && !e.endDate);
          const on = !manuallyOff && !hiddenByOngoing;
          const count = events.filter((e) => e.typeKey === lane.typeKey).length;
          return (
            <button
              key={lane.typeKey}
              type="button"
              onClick={() => toggleType(lane.typeKey)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors",
                on
                  ? "bg-white border-slate-200 text-slate-700"
                  : hiddenByOngoing
                    ? "bg-slate-50 border-transparent text-slate-400 opacity-40 line-through"
                    : "bg-slate-50 border-transparent text-slate-400 line-through"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: lane.color }}
              />
              {lane.typeLabel}
              <span className="text-slate-400">({count})</span>
            </button>
          );
        })}
      </div>

      {visibleEvents.some((e) => e.category === "symptom") && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="text-slate-400">Symptom severity:</span>
          {(["mild", "moderate", "severe"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[s] }} />
              {s}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            unspecified
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Fixed lane labels */}
        <div
          className="shrink-0 border-r border-slate-200 bg-slate-50 z-10"
          style={{ width: LABEL_WIDTH }}
        >
          <div className="h-14 border-b border-slate-100" aria-hidden />
          {visibleLanes.map((lane) => (
            <div
              key={lane.typeKey}
              className="flex items-center gap-2 px-3 text-xs text-slate-600 border-b border-slate-100 last:border-b-0"
              style={{ height: LANE_HEIGHT }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: lane.color }}
              />
              <span className="truncate font-medium" title={lane.typeLabel}>
                {lane.typeLabel}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
          <svg width={chartWidth} height={chartHeight} className="block">
            {/* Month grid */}
            {ticks.map((t) => {
              const x = xFor(new Date(t.ms).toISOString().slice(0, 10));
              return (
                <g key={t.ms}>
                  <line
                    x1={x}
                    y1={48}
                    x2={x}
                    y2={chartHeight}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={x}
                    y={36}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* Lane bands */}
            {visibleLanes.map((lane, i) => (
              <rect
                key={lane.typeKey}
                x={0}
                y={48 + i * LANE_HEIGHT}
                width={chartWidth}
                height={LANE_HEIGHT}
                fill={i % 2 === 0 ? "#f8fafc" : "#ffffff"}
              />
            ))}

            {/* Events */}
            {visibleEvents.map((event) => {
              const row = laneIndex.get(event.typeKey);
              if (row === undefined) return null;
              const xStart = xFor(event.date);
              const isOngoing = !event.endDate && (event.category === "symptom" || event.category === "therapy");
              const effectiveEndDate = event.endDate ?? (isOngoing ? todayStr : null);
              const xEnd = effectiveEndDate ? xFor(effectiveEndDate) : xStart;
              const y = 48 + row * LANE_HEIGHT + LANE_HEIGHT / 2;
              const lane = visibleLanes[row];
              const isSelected = selectedId === event.id;
              const isHovered = hoveredId === event.id;
              const r = isSelected || isHovered ? 9 : 7;
              const hasSpan = effectiveEndDate && xEnd > xStart + 4;
              const eventColor =
                event.category === "symptom" && event.meta?.severity
                  ? (SEVERITY_COLORS[event.meta.severity] ?? lane.color)
                  : lane.color;

              return (
                <g
                  key={event.id}
                  className="cursor-pointer"
                  onMouseEnter={(e) => { setHoveredId(event.id); setMousePos({ x: e.clientX, y: e.clientY }); }}
                  onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => { setHoveredId(null); setMousePos(null); }}
                  onClick={() => setSelectedId((id) => (id === event.id ? null : event.id))}
                >
                  {hasSpan && (
                    <rect
                      x={xStart}
                      y={y - 5}
                      width={Math.max(xEnd - xStart, 8)}
                      height={10}
                      rx={5}
                      fill={eventColor}
                      opacity={isSelected || isHovered ? 0.85 : 0.55}
                    />
                  )}
                  {(isSelected || isHovered) && !hasSpan && (
                    <circle cx={xStart} cy={y} r={14} fill={eventColor} opacity={0.15} />
                  )}
                  {!hasSpan && (
                    <circle
                      cx={xStart}
                      cy={y}
                      r={r}
                      fill={eventColor}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                  {hasSpan && (
                    <>
                      <circle cx={xStart} cy={y} r={5} fill={eventColor} stroke="#fff" strokeWidth={1.5} />
                      {isOngoing ? (
                        <circle cx={xEnd} cy={y} r={4} fill="#fff" stroke={eventColor} strokeWidth={1.5} strokeDasharray="3 2" />
                      ) : (
                        <circle cx={xEnd} cy={y} r={5} fill={eventColor} stroke="#fff" strokeWidth={1.5} />
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Hover tooltip — fixed so it follows the cursor regardless of scroll */}
      {hovered && !selected && mousePos && (
        <div
          className="fixed z-50 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm max-w-xs pointer-events-none"
          style={{ left: mousePos.x + 18, top: mousePos.y - 12 }}
        >
          <p className="font-medium text-slate-800">
            {hovered.category === "therapy" && hovered.meta?.medicationNames?.length
              ? hovered.meta.medicationNames.join(" · ")
              : hovered.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDate(hovered.date, locale)}
            {hovered.endDate ? ` → ${formatDate(hovered.endDate, locale)}` : (hovered.category === "symptom" || hovered.category === "therapy") ? " → ongoing" : ""}
            {" · "}{hovered.typeLabel}
          </p>
          <p className="text-slate-600 mt-2 leading-relaxed">{hovered.summary}</p>
        </div>
      )}

      {/* Selected detail */}
      {selected && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 px-5 py-4 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{selected.title}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {formatDate(selected.date, locale)}
                {selected.endDate ? ` → ${formatDate(selected.endDate, locale)}` : (selected.category === "symptom" || selected.category === "therapy") ? " → ongoing" : ""}
                {" · "}{selected.typeLabel}
              </p>
            </div>
            {selected.detailHref && (
              <Link
                href={selected.detailHref}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 shrink-0"
              >
                Open record →
              </Link>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{selected.summary}</p>
          {selected.meta?.abnormalCount != null && selected.meta.abnormalCount > 0 && (
            <p className="text-xs text-rose-600 font-medium">
              {selected.meta.abnormalCount} abnormal marker
              {selected.meta.abnormalCount === 1 ? "" : "s"}
            </p>
          )}
          {selected.category === "report" && (
            <ReportTimelineCategoryField
              reportId={selected.id}
              title={selected.title}
              clinicalSpecialty={selected.meta?.category}
              timelineCategoryManual={selected.meta?.timelineCategoryManual}
              compact
              onUpdated={() => onReportCategoryChange?.()}
            />
          )}
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-700"
            onClick={() => setSelectedId(null)}
          >
            Close
          </button>
        </div>
      )}

      {/* Compact list fallback for accessibility / mobile */}
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
          Chronological list ({visibleEvents.length} items)
        </summary>
        <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {events
            .filter((e) => !hiddenTypes.has(e.typeKey) && !hiddenCategories.has(e.category))
            .map((e) => {
              const hiddenByOngoing =
                ongoingOnly &&
                (e.category === "symptom" || e.category === "therapy") &&
                !!e.endDate;
              return (
                <li
                  key={e.id}
                  className={cn(
                    "flex gap-3 items-start py-2 border-b border-slate-100 last:border-0 transition-opacity",
                    hiddenByOngoing && "opacity-40"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      backgroundColor:
                        lanes.find((l) => l.typeKey === e.typeKey)?.color ?? "#94a3b8",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => !hiddenByOngoing && setSelectedId(e.id)}
                    >
                      <span className={cn("font-medium text-slate-800", hiddenByOngoing && "line-through")}>{e.title}</span>
                      <span className="text-slate-400 ml-2">{formatDateShort(e.date, locale)}</span>
                      {!hiddenByOngoing && <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{e.summary}</p>}
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      </details>
    </div>
  );
}
