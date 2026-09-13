"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Globe, User2 } from "lucide-react";
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

export function Header({ title }: { title: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { patients, selectedPatientId, setSelectedPatientId, loading } = usePatient();

  function switchLocale(newLocale: string) {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {isDemo && (
          <Badge variant="warning" title="This instance uses sample data — not real patients">
            Demo data
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <User2 className="w-4 h-4 text-slate-400" />
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            disabled={loading}
            className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px] max-w-[240px]"
          >
            <option value="">— Select patient —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-400" />
          <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value)}
            className="text-sm text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {routing.locales.map((l) => (
              <option key={l} value={l}>
                {localeLabels[l] ?? l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <UserButton />
      </div>
    </header>
  );
}
