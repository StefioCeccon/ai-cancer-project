"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);

  // Close drawer on route change
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile nav is open
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar
        locale={locale}
        labels={NAV_LABELS}
        open={navOpen}
        onClose={closeNav}
      />
      <div className="lg:pl-64 flex flex-col min-h-screen min-w-0">
        <Header title={title} onMenuClick={toggleNav} />
        <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
          {children}
        </main>
      </div>
      <ChatSidebar />
    </div>
  );
}
