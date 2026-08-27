(() => {
  // The dashboard shell itself is protected by API authorization. Do not
  // redirect from the shell based on a client-only assumption, which can
  // create redirect loops with Pages SPA rewrites.
  const path = window.location.pathname;
  const publicPaths = ["/dashboard/login", "/dashboard/login.html", "/dashboard/signup", "/dashboard/signup.html"];
  if (publicPaths.includes(path)) return;

  window.__RICA_DASHBOARD_AUTH_REQUIRED__ = true;
})();
