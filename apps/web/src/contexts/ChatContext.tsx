"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Message } from "@/components/chat/ChatMessage";
import { usePatient } from "@/contexts/PatientContext";

const STORAGE_PREFIX = "ai-cancer-project:chat:";
const NO_PATIENT_KEY = "_none";

type PersistedChat = {
  messages: Message[];
  selectedModel: string;
  isOpen: boolean;
};

interface ChatContextValue {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function storageKey(patientId: string): string {
  return `${STORAGE_PREFIX}${patientId || NO_PATIENT_KEY}`;
}

function loadPersisted(patientId: string): PersistedChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(patientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChat;
    if (!Array.isArray(parsed.messages)) return null;
    // Drop in-flight placeholders from a previous interrupted stream
    const messages = parsed.messages.filter((m) => !m.pending);
    return {
      messages,
      selectedModel: typeof parsed.selectedModel === "string" ? parsed.selectedModel : "gemini-2.5-flash",
      isOpen: Boolean(parsed.isOpen),
    };
  } catch {
    return null;
  }
}

function savePersisted(patientId: string, data: PersistedChat) {
  if (typeof window === "undefined") return;
  try {
    const toStore: PersistedChat = {
      ...data,
      messages: data.messages.filter((m) => !m.pending),
    };
    sessionStorage.setItem(storageKey(patientId), JSON.stringify(toStore));
  } catch {
    // Quota / private mode — ignore
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { selectedPatientId } = usePatient();
  const [activePatientId, setActivePatientId] = useState(selectedPatientId || NO_PATIENT_KEY);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate / switch thread when selected patient changes
  useEffect(() => {
    const nextKey = selectedPatientId || NO_PATIENT_KEY;

    if (hydrated && nextKey === activePatientId) return;

    // Persist current thread before switching (if already hydrated)
    if (hydrated) {
      savePersisted(activePatientId, { messages, selectedModel, isOpen });
    }

    const stored = loadPersisted(nextKey);
    setMessages(stored?.messages ?? []);
    setSelectedModel(stored?.selectedModel ?? "gemini-2.5-flash");
    setIsOpen(stored?.isOpen ?? false);
    setInput("");
    setActivePatientId(nextKey);
    setHydrated(true);
    // Only react to patient changes; avoid re-running on every message tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  // Persist after mutations (debounced via microtask batching of React state)
  useEffect(() => {
    if (!hydrated) return;
    savePersisted(activePatientId, { messages, selectedModel, isOpen });
  }, [hydrated, activePatientId, messages, selectedModel, isOpen]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setInput("");
    try {
      sessionStorage.removeItem(storageKey(activePatientId));
    } catch {
      // ignore
    }
  }, [activePatientId]);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      messages,
      setMessages,
      input,
      setInput,
      selectedModel,
      setSelectedModel,
      clearChat,
    }),
    [isOpen, messages, input, selectedModel, clearChat]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return ctx;
}
