"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Source_Serif_4, Source_Sans_3 } from "next/font/google";
import { ArrowRight, GitBranch, Activity, Scan, Users } from "lucide-react";

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-landing-display",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-landing-body",
  display: "swap",
});

const GITHUB_URL = "https://github.com/StefioCeccon/ai-cancer-project";

export function LandingPage() {
  const t = useTranslations("landing");
  const locale = useLocale();

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-dvh text-slate-900`}
      style={{ fontFamily: "var(--font-landing-body), system-ui, sans-serif" }}
    >
      <div className="relative overflow-hidden">
        {/* Atmosphere */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 10% 0%, rgba(14, 116, 144, 0.22), transparent 55%),
              radial-gradient(ellipse 70% 50% at 90% 10%, rgba(15, 118, 110, 0.18), transparent 50%),
              linear-gradient(165deg, #f0f7f8 0%, #e8eef2 45%, #dfe8ec 100%)
            `,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f766e' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Nav */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <p
            className="text-sm font-semibold tracking-wide text-teal-900/80"
            style={{ fontFamily: "var(--font-landing-display), Georgia, serif" }}
          >
            {t("brand")}
          </p>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/${locale}/sign-in`}
              className="text-slate-600 transition-colors hover:text-teal-800"
            >
              {t("signIn")}
            </Link>
            <Link
              href={`/${locale}/sign-up`}
              className="rounded-full bg-teal-800 px-3.5 py-1.5 font-medium text-white transition-colors hover:bg-teal-900"
            >
              {t("signUp")}
            </Link>
          </div>
        </header>

        {/* Hero — one composition */}
        <section className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl flex-col justify-center px-6 pb-20 pt-8 md:pt-4">
          <p
            className="landing-fade-in mb-4 text-4xl font-medium tracking-tight text-teal-950 sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-landing-display), Georgia, serif" }}
          >
            {t("brand")}
          </p>
          <h1
            className="landing-fade-in-delay-1 max-w-2xl text-xl font-normal leading-snug text-slate-700 sm:text-2xl md:text-3xl"
            style={{ fontFamily: "var(--font-landing-display), Georgia, serif" }}
          >
            {t("headline")}
          </h1>
          <p className="landing-fade-in-delay-2 mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {t("support")}
          </p>
          <div className="landing-fade-in-delay-3 mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={`/${locale}/sign-up`}
              className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-teal-900 hover:scale-[1.02] active:scale-[0.99]"
            >
              {t("ctaPrimary")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/sign-in`}
              className="inline-flex items-center gap-2 rounded-full border border-teal-800/25 bg-white/60 px-5 py-2.5 text-sm font-semibold text-teal-900 backdrop-blur-sm transition-colors hover:bg-white"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </section>
      </div>

      {/* Features — one job each */}
      <section className="border-t border-teal-900/10 bg-white">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 md:grid-cols-3 md:gap-10">
          <Feature
            icon={<Users className="h-5 w-5" />}
            title={t("features.mdt.title")}
            body={t("features.mdt.body")}
          />
          <Feature
            icon={<Scan className="h-5 w-5" />}
            title={t("features.imaging.title")}
            body={t("features.imaging.body")}
          />
          <Feature
            icon={<Activity className="h-5 w-5" />}
            title={t("features.markers.title")}
            body={t("features.markers.body")}
          />
        </div>
      </section>

      {/* Open source */}
      <section className="border-t border-teal-900/10 bg-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2
              className="text-2xl font-medium tracking-tight text-teal-950 sm:text-3xl"
              style={{ fontFamily: "var(--font-landing-display), Georgia, serif" }}
            >
              {t("oss.title")}
            </h2>
            <p className="mt-3 text-slate-600 leading-relaxed">{t("oss.body")}</p>
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-900"
          >
            <GitBranch className="h-4 w-4" />
            {t("oss.cta")}
          </a>
        </div>
      </section>

      <footer className="border-t border-teal-900/10 bg-white px-6 py-8 text-center text-xs text-slate-500">
        {t("footer")}
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-800/10 text-teal-800">
        {icon}
      </div>
      <h2
        className="text-lg font-medium text-teal-950"
        style={{ fontFamily: "var(--font-landing-display), Georgia, serif" }}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
