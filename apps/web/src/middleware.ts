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
  // Run on all routes except Next internals and static files, plus all API routes.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)", "/(api|trpc)(.*)"],
};
