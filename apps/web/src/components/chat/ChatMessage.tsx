"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils/cn";
import { Bot, User } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
        isUser ? "bg-blue-600" : "bg-slate-700"
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "bg-blue-600 text-white rounded-tr-sm"
          : "bg-slate-100 text-slate-800 rounded-tl-sm"
      )}>
        {message.pending ? (
          <TypingIndicator />
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className={cn(
            "prose prose-sm max-w-none",
            "[&>p]:mb-2 [&>p:last-child]:mb-0",
            "[&>ul]:mb-2 [&>ul]:pl-4 [&>ul>li]:mb-0.5",
            "[&>ol]:mb-2 [&>ol]:pl-4 [&>ol>li]:mb-0.5",
            "[&>h3]:font-semibold [&>h3]:mt-3 [&>h3]:mb-1 [&>h3]:text-sm",
            "[&>blockquote]:border-l-2 [&>blockquote]:border-slate-300 [&>blockquote]:pl-3 [&>blockquote]:text-slate-600 [&>blockquote]:italic",
            "[&>code]:bg-slate-200 [&>code]:px-1 [&>code]:rounded [&>code]:text-xs",
            "[&>strong]:font-semibold [&>em]:italic"
          )}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center h-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
