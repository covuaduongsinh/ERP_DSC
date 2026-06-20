import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/docs/openapi") ||
    pathname.startsWith("/api/intake"); // Form tuyển sinh công khai (thay submitConsultation/Trial của CLB)

  // Portal routes have their own auth — don't touch
  const isPortalRoute =
    pathname.startsWith("/portal") || pathname.startsWith("/api/portal");

  // If Supabase is not configured, block all non-public routes
  if (!supabaseUrl || !supabaseKey || supabaseKey.includes("placeholder")) {
    if (!isPublicRoute && !isPortalRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(
          ({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(
          ({
            name,
            value,
            options,
          }: {
            name: string;
            value: string;
            options?: any;
          }) => supabaseResponse.cookies.set(name, value, options),
        );
      },
    } as any,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Skip auth check for portal routes (they have own auth)
  if (isPortalRoute) {
    return supabaseResponse;
  }

  // Authenticated user trying to access login/register → redirect to dashboard
  if (user && isPublicRoute && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Unauthenticated user trying to access protected route
  if (!user && !isPublicRoute) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For page routes, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
