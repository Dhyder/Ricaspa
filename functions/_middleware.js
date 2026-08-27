import { getSession } from "./_lib/dashboardAuth.js";

const DASHBOARD_PREFIX = "/dashboard";
const PUBLIC_DASHBOARD_PATHS = new Set([
  "/dashboard/login",
  "/dashboard/login.html",
  "/dashboard/signup",
  "/dashboard/signup.html",
  "/dashboard/favicon.svg",
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Cloudflare Pages Functions middleware protects the dashboard before the
  // static SPA is served. This is the actual access-control boundary, not a
  // client-side redirect.
  if (path === DASHBOARD_PREFIX || path.startsWith(`${DASHBOARD_PREFIX}/`)) {
    if (!PUBLIC_DASHBOARD_PATHS.has(path)) {
      const session = await getSession(context);
      if (!session) {
        const login = new URL("/dashboard/login", url.origin);
        login.searchParams.set("returnTo", path + url.search);
        return Response.redirect(login.toString(), 302);
      }
    }
  }

  return context.next();
}
