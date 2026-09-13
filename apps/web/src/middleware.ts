import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Public routes — everything else requires authentication.
// Locale-prefixed variants are listed because next-intl rewrites "/" → "/<locale>".
const isPublicRoute = createRouteMatcher([
  "/",
  "/:locale",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Clerk's Vercel auto-proxy serves /__clerk/* (including *.js). Never protect
  // or locale-rewrite those — the SDK handles them before this callback when
  // possible; if we reach here, pass through.
  if (req.nextUrl.pathname.startsWith("/__clerk")) {
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // next-intl handles locale negotiation/rewrites for page routes only.
  // API routes are still protected above but must not be locale-rewritten.
  if (req.nextUrl.pathname.startsWith("/api")) {
    return;
  }

  return handleI18nRouting(req);
});

export const config = {
  // Default matcher skips paths with a "." (static files). Clerk's /__clerk
  // proxy must still run for assets like clerk.browser.js — list it explicitly.
  matcher: [
    "/((?!_next|_vercel|.*\\..*).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
