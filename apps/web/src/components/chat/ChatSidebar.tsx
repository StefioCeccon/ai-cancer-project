"use client";

import {
  useState, useRef, useEffect, useCallback, useTransition,
} from "react";
import {
  MessageCircle, X, Send, Bot,
  RotateCcw, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ChatMessage, type Message } from "./ChatMessage";
import { AI_MODELS } from "@ai-cancer-project/shared";
import type { AIProvider } from "@ai-cancer-project/shared";
import { usePatient } from "@/contexts/PatientContext";

const SUGGESTED_QUESTIONS = [
  "What do my recent blood test results mean?",
  "Are there any concerning trends in my data?",
  "What should I ask my doctor at the next visit?",
  "Can you summarise my cancer progression so far?",
  "What do my cancer marker levels indicate?",
  "Are there any red flags I should be aware of?",
];

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const { selectedPatientId, selectedPatient } = usePatient();
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [showSettings, setShowSettings] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<AIProvider[]>([]);
  const [, startTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load configured providers on first open
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/providers")
      .then((r) => r.json())
      .then((d) => setConfiguredProviders(d.data ?? ["gemini"]));
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const availableModels = Object.entries(AI_MODELS).filter(
    ([, m]) => configuredProviders.includes(m.provider as AIProvider)
  );

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };
    const pendingId = crypto.randomUUID();
    const pendingMessage: Message = {
      id: pendingId,
      role: "assistant",
      content: "",
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, pendingMessage]);
    setInput("");
    setIsStreaming(true);

    // Build message history for API (exclude the pending placeholder)
    const history = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current = new AbortController();

    try {
      const provider = AI_MODELS[selectedModel]?.provider as AIProvider ?? "gemini";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          patientId: selectedPatientId || undefined,
          messages: history,
          provider,
          model: selectedModel,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      // Replace pending with streaming content
      setMessages((prev) =>
        prev.map((m) => m.id === pendingId ? { ...m, pending: false, content: "" } : m)
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        startTransition(() => {
          setMessages((prev) =>
            prev.map((m) => m.id === pendingId ? { ...m, content: current } : m)
          );
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, pending: false, content: m.content || "[Stopped]" }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, pending: false, content: "Sorry, something went wrong. Please try again." }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [isStreaming, messages, selectedPatientId, selectedModel]);

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function clearChat() {
    setMessages([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "flex items-center justify-center transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isOpen
            ? "bg-slate-700 rotate-90"
            : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
        )}
        aria-label="Open AI Doctor chat"
      >
        {isOpen
          ? <X className="w-6 h-6 text-white" />
          : <MessageCircle className="w-6 h-6 text-white" />
        }
        {/* Unread dot when closed with messages */}
        {!isOpen && messages.length > 0 && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat panel */}
      <div className={cn(
        "fixed bottom-0 right-0 z-50 flex flex-col",
        "w-full md:w-[420px] md:bottom-6 md:right-24",
        "h-[100dvh] md:h-[680px] md:max-h-[85vh]",
        "bg-white md:rounded-2xl shadow-2xl border border-slate-200",
        "transition-all duration-300 ease-out origin-bottom-right",
        isOpen
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-95 pointer-events-none"
      )}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-900 md:rounded-t-2xl flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">AI Doctor</p>
            <p className="text-slate-400 text-xs truncate">
              {selectedPatient
                ? `Loaded: ${selectedPatient.firstName} ${selectedPatient.lastName}`
                : "No patient selected"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
              title="Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                title="Clear chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Settings panel ────────────────────────────────────────────── */}
        {showSettings && (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-3 flex-shrink-0">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {availableModels.length === 0 ? (
                  <option value="">No providers configured</option>
                ) : (
                  availableModels.map(([id, m]) => (
                    <option key={id} value={id}>{m.label}</option>
                  ))
                )}
              </select>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium text-center py-1"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Messages ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
          {messages.length === 0 ? (
            <EmptyState
              patientName={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined}
              onSelect={(q) => sendMessage(q)}
              hasPatient={!!selectedPatientId}
            />
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-slate-100">
          <div className="flex gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={selectedPatientId
                ? "Ask about blood tests, reports, progression..."
                : "Ask a general oncology question..."}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none leading-relaxed min-h-[24px] max-h-[140px]"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 hover:bg-red-200 transition-colors flex-shrink-0"
                title="Stop"
              >
                <span className="w-2.5 h-2.5 bg-red-600 rounded-sm" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0",
                  input.trim()
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
                title="Send (Enter)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            AI responses are not medical advice · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

// ── Empty state with suggested questions ─────────────────────────────────────
function EmptyState({
  patientName,
  onSelect,
  hasPatient,
}: {
  patientName?: string;
  onSelect: (q: string) => void;
  hasPatient: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center py-4 gap-4">
      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
        <Bot className="w-7 h-7 text-blue-600" />
      </div>
      <div>
        <p className="font-semibold text-slate-800 text-sm">
          {patientName ? `Loaded: ${patientName}` : "AI Doctor"}
        </p>
        <p className="text-slate-500 text-xs mt-1 max-w-[280px]">
          {hasPatient
            ? "I have access to this patient's blood tests, reports, imaging, and previous analyses. Ask me anything."
            : "Select a patient from the header to get personalised answers, or ask general oncology questions."}
        </p>
      </div>

      <div className="w-full space-y-2">
        <p className="text-xs text-slate-400 font-medium">Suggested questions</p>
        {SUGGESTED_QUESTIONS.slice(0, hasPatient ? 6 : 3).map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg px-3 py-2 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
