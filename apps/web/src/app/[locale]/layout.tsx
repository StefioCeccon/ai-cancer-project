import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ClientProviders } from "@/components/providers/ClientProviders";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Open Cancer AI Project",
  description:
    "Self-hostable AI oncology platform — track blood markers and imaging over time, gather your reports, and get insight from a panel of specialist AI agents. Source available under a noncommercial license.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    notFound();
  }
  const messages = await getMessages();

  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang={locale}>
        <body>
          <NextIntlClientProvider messages={messages}>
            <ClientProviders>{children}</ClientProviders>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
