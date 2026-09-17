"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Scan, FlaskConical, Microscope, Heart, BookOpen, ClipboardList,
  Stethoscope, Play, CheckCircle2, Loader2, Users, ChevronDown,
  ChevronUp, MessageSquare, FileText, ArrowRight, Send,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { usePatient } from "@/contexts/PatientContext";
import type { MDTSpecialistRole, MDTSSEEvent, AIProvider } from "@ai-cancer-project/shared";

// ─── Metadata ─────────────────────────────────────────────────────────────────

const SPECIALIST_META: Record<
  MDTSpecialistRole,
  { label: string; icon: React.ElementType; color: string }
> = {
  radiologist:     { label: "Radiologist",       icon: Scan,          color: "bg-blue-50 text-blue-700 border-blue-200" },
  endocrinologist: { label: "Endocrinologist",    icon: FlaskConical,  color: "bg-purple-50 text-purple-700 border-purple-200" },
  pathologist:     { label: "Pathologist",        icon: Microscope,    color: "bg-amber-50 text-amber-700 border-amber-200" },
  palliative:      { label: "Palliative & Risk",  icon: Heart,         color: "bg-rose-50 text-rose-700 border-rose-200" },
  research_doctor: { label: "Research Doctor",    icon: BookOpen,      color: "bg-teal-50 text-teal-700 border-teal-200" },
  clinical_trials: { label: "Clinical Trials",    icon: ClipboardList, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  oncologist:      { label: "Oncologist",         icon: Stethoscope,   color: "bg-green-50 text-green-700 border-green-200" },
};

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini:    "gemini-2.5-flash",
  openai:    "gpt-4o",
  anthropic: "claude-sonnet-4-6",
  mistral:   "mistral-large-latest",
};

type ConsultationPhase = "idle" | "round1" | "discussion" | "synthesis" | "followup" | "done" | "error";

// ─── Timeline types ───────────────────────────────────────────────────────────

type TLItem =
  | { id: string; kind: "phase";        label: string }
  | { id: string; kind: "doc_selection"; role: MDTSpecialistRole; titles: string[] }
  | { id: string; kind: "report";        role: MDTSpecialistRole; report: string }
  | { id: string; kind: "discussion";    role: MDTSpecialistRole; comment: string }
  | { id: string; kind: "draft";         round: number; report: string }
  | { id: string; kind: "question";      round: number; toRole: MDTSpecialistRole; question: string }
  | { id: string; kind: "answer";        round: number; role: MDTSpecialistRole; answer: string }
  | { id: string; kind: "final";         report: string };

// ─── Timeline item components ─────────────────────────────────────────────────

function SpecialistIcon({ role, size = "md" }: { role: MDTSpecialistRole; size?: "sm" | "md" }) {
  const meta = SPECIALIST_META[role];
  const Icon = meta.icon;
  const cls = size === "sm"
    ? `w-7 h-7 rounded-md text-[11px] ${meta.color}`
    : `w-8 h-8 rounded-lg ${meta.color}`;
  return (
    <div className={`${cls} border flex items-center justify-center flex-shrink-0`}>
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
    </div>
  );
}

function TLPhase({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-slate-200" />
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">{label}</span>
      </div>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function TLDocSelection({ item }: { item: Extract<TLItem, { kind: "doc_selection" }> }) {
  const meta = SPECIALIST_META[item.role];
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-3">
      <SpecialistIcon role={item.role} />
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
          <span className="text-xs text-slate-400">
            selected {item.titles.length} document{item.titles.length !== 1 ? "s" : ""}
          </span>
          {item.titles.length > 0 && (
            <button
              onClick={() => setOpen(v => !v)}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 ml-1"
            >
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {open ? "hide" : "view"}
            </button>
          )}
        </div>
        {open && item.titles.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {item.titles.map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                <FileText className="w-3 h-3 mt-0.5 text-slate-300 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TLReport({ item }: { item: Extract<TLItem, { kind: "report" }> }) {
  const meta = SPECIALIST_META[item.role];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex items-start gap-3">
      <SpecialistIcon role={item.role} />
      <div className="flex-1 min-w-0">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-bold text-slate-800">{meta.label} — Assessment</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto flex-shrink-0" />
          </div>
          {expanded ? (
            <MarkdownContent>{item.report}</MarkdownContent>
          ) : (
            <div style={{ maxHeight: "10rem", overflowY: "hidden" }}>
              <MarkdownContent>{item.report}</MarkdownContent>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" />Show less</>
              : <><ChevronDown className="w-3 h-3" />Read full assessment</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TLDiscussion({ item }: { item: Extract<TLItem, { kind: "discussion" }> }) {
  const meta = SPECIALIST_META[item.role];
  const [expanded, setExpanded] = useState(false);
  const isLong = item.comment.length > 300;

  return (
    <div className="flex items-start gap-3">
      <SpecialistIcon role={item.role} />
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
          <MessageSquare className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400">responds to team</span>
        </div>
        {expanded || !isLong ? (
          <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-wrap">{item.comment}</p>
        ) : (
          <p className="text-sm text-slate-600 italic leading-relaxed line-clamp-3">{item.comment}</p>
        )}
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" />Show less</>
              : <><ChevronDown className="w-3 h-3" />Read full comment</>}
          </button>
        )}
      </div>
    </div>
  );
}

function TLDraft({ item }: { item: Extract<TLItem, { kind: "draft" }> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex items-start gap-3">
      <SpecialistIcon role="oncologist" />
      <div className="flex-1 min-w-0">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-bold text-amber-800">Oncologist — Draft Synthesis</span>
            <span className="text-xs text-amber-600 border border-amber-300 rounded-full px-2 py-0.5">Round {item.round}</span>
            <span className="text-xs text-amber-500 ml-auto">Consulting specialists…</span>
          </div>
          {expanded ? (
            <MarkdownContent>{item.report}</MarkdownContent>
          ) : (
            <div style={{ maxHeight: "8rem", overflowY: "hidden" }}>
              <MarkdownContent>{item.report}</MarkdownContent>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" />Show less</>
              : <><ChevronDown className="w-3 h-3" />Read draft</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TLQuestion({ item }: { item: Extract<TLItem, { kind: "question" }> }) {
  const targetMeta = SPECIALIST_META[item.toRole];
  const TargetIcon = targetMeta.icon;

  return (
    <div className="flex items-start gap-3">
      <SpecialistIcon role="oncologist" />
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-xs font-semibold text-green-700">Oncologist</span>
          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${targetMeta.color}`}>
            <TargetIcon className="w-3 h-3" />
            {targetMeta.label}
          </div>
        </div>
        <p className="text-sm text-slate-700 italic leading-relaxed">"{item.question}"</p>
      </div>
    </div>
  );
}

function TLAnswer({ item }: { item: Extract<TLItem, { kind: "answer" }> }) {
  const meta = SPECIALIST_META[item.role];

  return (
    <div className="flex items-start gap-3 ml-4 sm:ml-11">
      <SpecialistIcon role={item.role} size="sm" />
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-slate-700">{meta.label}</span>
          <span className="text-xs text-slate-400">responds</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
}

function TLFinal({ item }: { item: Extract<TLItem, { kind: "final" }> }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl border-2 border-green-300 bg-green-50 text-green-700 flex items-center justify-center flex-shrink-0">
        <Stethoscope className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-green-900">Final MDT Recommendation</span>
            <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto flex-shrink-0" />
          </div>
          {expanded ? (
            <MarkdownContent>{item.report}</MarkdownContent>
          ) : (
            <div style={{ maxHeight: "16rem", overflowY: "hidden" }}>
              <MarkdownContent>{item.report}</MarkdownContent>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-green-700 hover:text-green-900 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" />Show less</>
              : <><ChevronDown className="w-3 h-3" />Read full synthesis</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: TLItem }) {
  switch (item.kind) {
    case "phase":         return <TLPhase label={item.label} />;
    case "doc_selection": return <TLDocSelection item={item} />;
    case "report":        return <TLReport item={item} />;
    case "discussion":    return <TLDiscussion item={item} />;
    case "draft":         return <TLDraft item={item} />;
    case "question":      return <TLQuestion item={item} />;
    case "answer":        return <TLAnswer item={item} />;
    case "final":         return <TLFinal item={item} />;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MDTPage() {
  const { selectedPatient, selectedPatientId } = usePatient();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [model, setModel] = useState<string>(DEFAULT_MODELS.gemini);
  const [consultationQuestion, setConsultationQuestion] = useState("");

  const [phase, setPhase] = useState<ConsultationPhase>("idle");
  const [timeline, setTimeline] = useState<TLItem[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [currentFollowUpRound, setCurrentFollowUpRound] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [runId, setRunId] = useState<string>();
  const [chatHistory, setChatHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/providers")
      .then(r => r.json())
      .then(d => {
        const configured: AIProvider[] = d.data ?? [];
        setProviders(configured);
        if (configured.length > 0 && !configured.includes(provider)) {
          setProvider(configured[0]);
          setModel(DEFAULT_MODELS[configured[0]]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [timeline.length]);

  const resetState = useCallback(() => {
    setPhase("round1");
    setErrorMessage(undefined);
    setCompletedCount(0);
    setCurrentFollowUpRound(0);
    setRunId(undefined);
    setChatHistory([]);
    setChatInput("");
    setTimeline([{ id: "phase-r1", kind: "phase", label: "Round 1 — Specialist Reports" }]);
  }, []);

  const handleEvent = useCallback((event: MDTSSEEvent) => {
    switch (event.type) {
      case "specialist_selecting":
        setTimeline(prev => [...prev, {
          id: `docsel-${event.role}`,
          kind: "doc_selection",
          role: event.role,
          titles: event.selectedTitles,
        }]);
        break;

      case "specialist":
        setTimeline(prev => [...prev, {
          id: `report-${event.role}`,
          kind: "report",
          role: event.role,
          report: event.report,
        }]);
        setCompletedCount(n => n + 1);
        break;

      case "phase":
        if (event.phase === "discussion") {
          setTimeline(prev => [...prev, { id: "phase-disc", kind: "phase", label: "Round 2 — Team Discussion" }]);
          setPhase("discussion");
        } else if (event.phase === "synthesis") {
          setPhase("synthesis");
          setTimeline(prev => {
            const last = prev[prev.length - 1];
            if (last?.kind === "phase" && (last.label.includes("Synthesis") || last.label.includes("Oncologist"))) return prev;
            return [...prev, { id: `phase-syn-${Date.now()}`, kind: "phase", label: "Oncologist Synthesis" }];
          });
        } else if (event.phase === "followup") {
          const round = event.round ?? 1;
          setCurrentFollowUpRound(round);
          setTimeline(prev => [...prev, { id: `phase-fu-${round}`, kind: "phase", label: `Follow-up Round ${round}` }]);
          setPhase("followup");
        }
        break;

      case "discussion":
        setTimeline(prev => [...prev, {
          id: `disc-${event.role}`,
          kind: "discussion",
          role: event.role,
          comment: event.comment,
        }]);
        break;

      case "synthesis_draft":
        setTimeline(prev => [...prev, {
          id: `draft-${event.round}`,
          kind: "draft",
          round: event.round,
          report: event.report,
        }]);
        setPhase("synthesis");
        break;

      case "followup_question":
        setTimeline(prev => [...prev, {
          id: `q-${event.round}-${event.toRole}`,
          kind: "question",
          round: event.round,
          toRole: event.toRole,
          question: event.question,
        }]);
        break;

      case "followup_answer":
        setTimeline(prev => [...prev, {
          id: `a-${event.round}-${event.role}`,
          kind: "answer",
          round: event.round,
          role: event.role,
          answer: event.answer,
        }]);
        break;

      case "synthesis":
        setTimeline(prev => [...prev, {
          id: "final",
          kind: "final",
          report: event.report,
        }]);
        break;

      case "done":
        setRunId(event.runId);
        setPhase("done");
        break;

      case "error":
        setErrorMessage(event.message);
        setPhase("error");
        break;
    }
  }, []);

  const startConsultation = useCallback(async () => {
    if (!selectedPatientId) return;
    resetState();

    try {
      const response = await fetch("/api/mdt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          provider,
          model,
          question: consultationQuestion.trim() || undefined,
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to start MDT consultation");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed: MDTSSEEvent = JSON.parse(line.slice(6));
            handleEvent(parsed);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Consultation failed");
      setPhase("error");
    }
  }, [selectedPatientId, provider, model, consultationQuestion, resetState, handleEvent]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !runId || !selectedPatientId || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/mdt/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId, runId, provider, model, question, chatHistory }),
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory(prev => [...prev, { question, answer: data.answer }]);
      } else {
        setChatHistory(prev => [...prev, { question, answer: `Error: ${data.error ?? "Chat failed"}` }]);
      }
    } catch {
      setChatHistory(prev => [...prev, { question, answer: "Error: request failed" }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, runId, selectedPatientId, provider, model, chatHistory, chatLoading]);

  const isRunning = phase !== "idle" && phase !== "done" && phase !== "error";

  const phaseLabel: Record<ConsultationPhase, string> = {
    idle:       "",
    round1:     `Specialists reporting in parallel — ${completedCount}/6 done`,
    discussion: "Team discussion in progress…",
    synthesis:  "Oncologist synthesising all reports…",
    followup:   `Follow-up round ${currentFollowUpRound} — consulting specialists…`,
    done:       "Consultation complete",
    error:      "Error",
  };

  const phaseProgress: Record<ConsultationPhase, number> = {
    idle: 0, round1: 5 + (completedCount / 6) * 35,
    discussion: 45, synthesis: 65,
    followup: 70 + currentFollowUpRound * 8,
    done: 100, error: 0,
  };

  return (
    <AppShell title="Multi Disciplinary Team Consultation">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Multi Disciplinary Team Consultation</h1>
        </div>
        <p className="text-sm text-slate-500">
          6 AI specialists report in parallel → team discussion → oncologist synthesises → up to 3 follow-up rounds if needed.
        </p>
      </div>

      {/* No patient */}
      {!selectedPatientId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No patient selected</p>
            <p className="text-xs mt-1">Select a patient from the dropdown in the header.</p>
          </CardContent>
        </Card>
      )}

      {selectedPatient && (
        <>
          {/* Controls */}
          <Card className="mb-6">
            <CardContent className="py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p className="text-xs text-slate-500">Selected patient</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Provider</label>
                    <select
                      value={provider}
                      onChange={e => { const p = e.target.value as AIProvider; setProvider(p); setModel(DEFAULT_MODELS[p]); }}
                      disabled={isRunning}
                      className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {(providers.length > 0 ? providers : [provider]).map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Model</label>
                    <input
                      type="text"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      disabled={isRunning}
                      className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 w-44"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Specific question for the team <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={consultationQuestion}
                  onChange={e => setConsultationQuestion(e.target.value)}
                  disabled={isRunning}
                  rows={2}
                  placeholder="e.g. Is the patient a candidate for immunotherapy? Should we reconsider the current chemotherapy regimen given the latest bloods?"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Button
                  onClick={startConsultation}
                  disabled={isRunning || !selectedPatientId}
                  loading={isRunning}
                >
                  <Play className="w-4 h-4" />
                  {isRunning ? "Consultation in progress…" : "Start MDT Consultation"}
                </Button>

                {phase === "done" && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">✓ Complete</p>
                )}
                {phase === "error" && errorMessage && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 max-w-md">{errorMessage}</p>
                )}
              </div>

              {isRunning && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">{phaseLabel[phase]}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${phaseProgress[phase]}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Idle prompt */}
          {phase === "idle" && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium text-slate-600">Ready to begin</p>
                <p className="text-xs mt-1 text-center max-w-sm">
                  Click &quot;Start MDT Consultation&quot; to convene the team on {selectedPatient.firstName}&apos;s case.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          {phase !== "idle" && (
            <div className="space-y-4">
              {timeline.map(item => (
                <TimelineItem key={item.id} item={item} />
              ))}

              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-slate-400 pl-4 sm:pl-11 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  {phaseLabel[phase]}
                </div>
              )}

              <div ref={bottomRef} className="h-4" />
            </div>
          )}

          {/* Post-consultation chat */}
          {phase === "done" && runId && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="w-4 h-4 text-green-600" />
                <p className="text-sm font-semibold text-slate-800">Ask the Oncologist</p>
                <span className="text-xs text-slate-400">— follow-up questions based on the full consultation</span>
              </div>

              {/* Chat history */}
              {chatHistory.length > 0 && (
                <div className="space-y-4 mb-4">
                  {chatHistory.map((h, i) => (
                    <div key={i} className="space-y-2">
                      {/* User question */}
                      <div className="flex justify-end">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                          <p className="text-sm text-blue-900">{h.question}</p>
                        </div>
                      </div>
                      {/* Oncologist answer */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg border bg-green-50 text-green-700 border-green-200 flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl rounded-tl-sm px-4 py-2.5">
                          <MarkdownContent>{h.answer}</MarkdownContent>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  disabled={chatLoading}
                  rows={2}
                  placeholder="Ask a question about this patient's case… (Enter to send)"
                  className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 resize-none placeholder:text-slate-400"
                />
                <button
                  onClick={sendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 self-end"
                >
                  {chatLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
