import { getSession } from "./_lib/dashboardAuth.js";

const DASHBOARD_PREFIX = "/dashboard";
const PUBLIC_DASHBOARD_PATHS = new Set([
  "/dashboard/login",
  "/dashboard/login.html",
  "/dashboard/signup",
  "/dashboard/signup.html",
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Static dashboard assets must remain public so the login page can render.
  if (path.startsWith("/dashboard/assets/") || path.startsWith("/dashboard/images/")) {
    return context.next();
  }

  if (path === DASHBOARD_PREFIX || path.startsWith(`${DASHBOARD_PREFIX}/`)) {
    if (PUBLIC_DASHBOARD_PATHS.has(path)) return context.next();

    const session = await getSession(context);
    if (!session) {
      // Go directly to the static login document. Do not route through
      // /dashboard/login, which was previously rewritten by _redirects and
      // could cause Pages middleware/rewrite recursion.
      const login = new URL("/dashboard/login.html", url.origin);
      login.searchParams.set("returnTo", path + url.search);
      return Response.redirect(login.toString(), 302);
    }
  }

  return context.next();
}
