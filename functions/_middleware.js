import { getSession } from "./_lib/dashboardAuth.js";

const DASHBOARD_PREFIX = "/dashboard";
const PUBLIC_DASHBOARD_PATHS = new Set(["/dashboard/login","/dashboard/login.html","/dashboard/signup","/dashboard/signup.html"]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path.startsWith("/dashboard/assets/") || path.startsWith("/dashboard/images/")) return context.next();

  if (path === DASHBOARD_PREFIX || path.startsWith(`${DASHBOARD_PREFIX}/`)) {
    if (!PUBLIC_DASHBOARD_PATHS.has(path)) {
      const session = await getSession(context);
      if (!session) {
        const login = new URL("/dashboard/login.html", url.origin);
        login.searchParams.set("returnTo", path + url.search);
        return Response.redirect(login.toString(), 302);
      }
    }
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("head", { element(element) {
      element.append('<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#173d31">', { html: true });
    }})
    .on("body", { element(element) {
      element.append('<script src="/assets/js/tiktok-events.js" defer></script><script>if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));}</script>', { html: true });
    }}).transform(response);
}
