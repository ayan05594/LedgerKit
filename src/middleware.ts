import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

const AUTH_PAGES = new Set(["/login", "/register"]);
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
]);

export async function middleware(request: NextRequest) {
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
  const path = request.nextUrl.pathname;

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
      return NextResponse.json(
        { ok: false, error: "Please sign in to continue." },
        { status: 401 },
      );
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    return NextResponse.redirect(login);
  }

  if (isAuthenticated && AUTH_PAGES.has(path)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
