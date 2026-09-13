import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils/cn";

interface MarkdownContentProps {
  children: string;
  className?: string;
}

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-slate-700",
        "[&>p]:mb-2 [&>p:last-child]:mb-0",
        "[&>ul]:mb-2 [&>ul]:pl-4 [&>ul>li]:mb-0.5",
        "[&>ol]:mb-2 [&>ol]:pl-4 [&>ol>li]:mb-0.5",
        "[&>h2]:font-semibold [&>h2]:text-base [&>h2]:mt-4 [&>h2]:mb-2 [&>h2]:text-slate-800",
        "[&>h3]:font-semibold [&>h3]:text-sm [&>h3]:mt-3 [&>h3]:mb-1 [&>h3]:text-slate-800",
        "[&>blockquote]:border-l-2 [&>blockquote]:border-slate-300 [&>blockquote]:pl-3 [&>blockquote]:text-slate-600 [&>blockquote]:italic",
        "[&>code]:bg-slate-200 [&>code]:px-1 [&>code]:rounded [&>code]:text-xs",
        "[&>strong]:font-semibold [&>em]:italic",
        className,
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
