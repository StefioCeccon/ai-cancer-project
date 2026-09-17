"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Scan,
  FlaskConical,
  FileText,
  BrainCircuit,
  Settings,
  Activity,
  GitBranch,
  HeartPulse,
  Pill,
  Stethoscope,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "patients", href: "/patients", icon: Users },
  { key: "imaging", href: "/imaging", icon: Scan },
  { key: "bloodTests", href: "/blood-tests", icon: FlaskConical },
  { key: "symptoms", href: "/symptoms", icon: HeartPulse },
  { key: "therapies", href: "/therapies", icon: Pill },
  { key: "timelines", href: "/timelines", icon: GitBranch },
  { key: "reports", href: "/reports", icon: FileText },
  { key: "analysis", href: "/analysis", icon: BrainCircuit },
  { key: "mdt", href: "/mdt", icon: Stethoscope },
] as const;

interface SidebarProps {
  locale: string;
  labels: {
    dashboard: string;
    patients: string;
    imaging: string;
    bloodTests: string;
    symptoms: string;
    therapies: string;
    timelines: string;
    reports: string;
    analysis: string;
    mdt: string;
    settings: string;
  };
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ locale, labels, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-slate-900 flex flex-col",
          "transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              AI Cancer Project
            </p>
            <p className="text-slate-400 text-xs">Oncology Platform</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, href, icon: Icon }) => {
            const fullHref = `/${locale}${href}`;
            const isActive = pathname.startsWith(fullHref);
            return (
              <Link
                key={key}
                href={fullHref}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {labels[key]}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700">
          <Link
            href={`/${locale}/settings`}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
            {labels.settings}
          </Link>
        </div>
      </aside>
    </>
  );
}
