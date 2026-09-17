"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Globe, Menu, User2 } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { routing } from "@/i18n/routing";
import { usePatient } from "@/contexts/PatientContext";
import { Badge } from "@/components/ui/Badge";

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const localeLabels: Record<string, string> = {
  en: "EN",
  it: "IT",
  es: "ES",
  fr: "FR",
  de: "DE",
};

export function Header({
  title,
  onMenuClick,
}: {
  title: string;
  onMenuClick: () => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { patients, selectedPatientId, setSelectedPatientId, loading } =
    usePatient();

  function switchLocale(newLocale: string) {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-14 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden shrink-0 p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
            {title}
          </h1>
          {isDemo && (
            <Badge
              variant="warning"
              title="This instance uses sample data — not real patients"
              className="shrink-0 hidden sm:inline-flex"
            >
              Demo
            </Badge>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <User2 className="w-4 h-4 text-slate-400" />
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={loading}
            className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px] max-w-[220px]"
          >
            <option value="">— Select patient —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
                {p.role && p.role !== "owner" ? ` (${p.role})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Globe className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value)}
            className="text-sm text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Language"
          >
            {routing.locales.map((l) => (
              <option key={l} value={l}>
                {localeLabels[l] ?? l.toUpperCase()}
              </option>
            ))}
          </select>
          <UserButton />
        </div>
      </div>

      {/* Patient picker on its own row below md */}
      <div className="md:hidden flex items-center gap-2 px-4 pb-3">
        <User2 className="w-4 h-4 text-slate-400 shrink-0" />
        <select
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          disabled={loading}
          className="flex-1 min-w-0 text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select patient —</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
              {p.role && p.role !== "owner" ? ` (${p.role})` : ""}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
