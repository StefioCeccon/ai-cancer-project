import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Public routes — everything else requires authentication.
const isPublicRoute = createRouteMatcher([
  "/",
  "/:locale",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname.startsWith("/__clerk")) {
    return;
  }

  // Uploaded PHI must never be world-readable (dot-paths used to bypass the matcher).
  if (req.nextUrl.pathname.startsWith("/uploads/")) {
    await auth.protect();
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  if (req.nextUrl.pathname.startsWith("/api")) {
    return;
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    // Default: skip static files with a "." — EXCEPT /uploads/* (PHI)
    "/((?!_next|_vercel|uploads/|.*\\..*).*)",
    "/uploads/(.*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
