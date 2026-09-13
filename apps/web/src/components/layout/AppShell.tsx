"use client";

import { useLocale } from "next-intl";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

const NAV_LABELS = {
  dashboard: "Dashboard",
  patients: "Patients",
  imaging: "Imaging",
  bloodTests: "Blood Tests",
  symptoms: "Symptoms",
  therapies: "Therapies",
  timelines: "Timelines",
  reports: "Reports",
  analysis: "AI Analysis",
  mdt: "MDT Consultation",
  settings: "Settings",
};

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar locale={locale} labels={NAV_LABELS} />
      <div className="pl-64 flex flex-col min-h-screen">
        <Header title={title} />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <ChatSidebar />
    </div>
  );
}
