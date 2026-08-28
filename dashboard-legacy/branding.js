(() => {
  const css = document.createElement("style");
  css.textContent = `
    :root { --rica-primary: 29 78 62; --rica-accent: 191 154 88; }
    [data-rica-watermark], .rica-watermark { display:none!important; }
  `;
  document.head.appendChild(css);
  document.title = "Rica Spa | Admin";

  const clean = () => {
    document.querySelectorAll("*").forEach((el) => {
      if (el.childElementCount === 0 && /Shadcn Admin|Upgrade to Pro|shadcn-admin/i.test(el.textContent || "")) {
        el.textContent = el.textContent.replace(/Shadcn Admin/gi, "Rica Spa").replace(/Upgrade to Pro/gi, "");
      }
      if (el.id === "shadcn-admin-logo") el.removeAttribute("id");
    });
  };

  const renderUser = async () => {
    try {
      const res = await fetch("/api/dashboard-me", { credentials: "include" });
      if (!res.ok) return;
      const { user } = await res.json();
      document.documentElement.dataset.ricaRole = user.role;
      document.documentElement.dataset.ricaUser = user.email;
      clean();
      document.querySelectorAll("[data-rica-user]").forEach((el) => {
        el.textContent = user.name;
      });
      document.querySelectorAll("[data-rica-role]").forEach((el) => {
        el.textContent = user.role === "superuser" ? "Superuser" : "Employee";
      });
    } catch {}
  };

  const observer = new MutationObserver(() => clean());
  observer.observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener("load", renderUser);
  setTimeout(renderUser, 700);
  setTimeout(renderUser, 1800);
})();
