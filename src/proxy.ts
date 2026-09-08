import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

const AUTH_PAGES = new Set(["/login", "/register"]);
const CARD_ONBOARDING_PAGE = "/onboarding/cards";
const CARD_ONBOARDING_API = "/api/card-selection";
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
]);

function hasCompletedCardOnboarding(claims: unknown) {
  if (!claims || typeof claims !== "object") return false;
  const appMetadata = (claims as { app_metadata?: unknown }).app_metadata;
  return Boolean(
    appMetadata &&
      typeof appMetadata === "object" &&
      (appMetadata as { card_onboarding_completed?: unknown })
        .card_onboarding_completed === true,
  );
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Never trust a value supplied by the browser. Middleware replaces it only
  // after Supabase has verified the session below.
  requestHeaders.delete("x-ledgerkit-user-id");

  const nextResponse = () =>
    NextResponse.next({ request: { headers: requestHeaders } });
  let response = nextResponse();
  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = nextResponse();
        for (const { name, value, options } of values) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const isAuthenticated = Boolean(userId);
  const cardOnboardingComplete = hasCompletedCardOnboarding(data?.claims);
  const path = request.nextUrl.pathname;
  const preserveAuthCookies = <T extends NextResponse>(next: T) => {
    for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
    return next;
  };

  if (userId) {
    requestHeaders.set("x-ledgerkit-user-id", userId);
    const authenticatedResponse = nextResponse();
    for (const cookie of response.cookies.getAll()) {
      authenticatedResponse.cookies.set(cookie);
    }
    response = authenticatedResponse;
  }

  if (!isAuthenticated && !AUTH_PAGES.has(path) && !PUBLIC_API.has(path)) {
    if (path.startsWith("/api/")) {
      return preserveAuthCookies(
        NextResponse.json(
          { ok: false, error: "Please sign in to continue." },
          { status: 401 },
        ),
      );
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return preserveAuthCookies(NextResponse.redirect(login));
  }

  if (isAuthenticated && AUTH_PAGES.has(path)) {
    const destination = request.nextUrl.clone();
    destination.pathname = cardOnboardingComplete ? "/" : CARD_ONBOARDING_PAGE;
    return preserveAuthCookies(NextResponse.redirect(destination));
  }

  if (isAuthenticated && !cardOnboardingComplete) {
    const mayFinishOnboarding =
      path === CARD_ONBOARDING_PAGE ||
      path === CARD_ONBOARDING_API ||
      path.startsWith(`${CARD_ONBOARDING_API}/`) ||
      path === "/api/auth/logout" ||
      path === "/api/health";

    if (!mayFinishOnboarding) {
      if (path.startsWith("/api/")) {
        return preserveAuthCookies(
          NextResponse.json(
            {
              ok: false,
              error: "Choose your cards before continuing.",
              code: "CARD_ONBOARDING_REQUIRED",
            },
            { status: 428 },
          ),
        );
      }
      const onboarding = request.nextUrl.clone();
      onboarding.pathname = CARD_ONBOARDING_PAGE;
      return preserveAuthCookies(NextResponse.redirect(onboarding));
    }
  }

  if (
    isAuthenticated &&
    cardOnboardingComplete &&
    path === CARD_ONBOARDING_PAGE
  ) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    return preserveAuthCookies(NextResponse.redirect(home));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
