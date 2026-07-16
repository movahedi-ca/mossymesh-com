/**
 * Shared site chrome: mobile nav + current-page highlighting.
 */
function initNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const links = document.querySelector<HTMLElement>("[data-nav-links]");
  if (!toggle || !links) return;

  const setOpen = (open: boolean) => {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => {
    setOpen(!links.classList.contains("open"));
  });

  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

function markCurrentNav(): void {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll<HTMLAnchorElement>("[data-nav-links] a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("http")) return;
    const normalized = href.replace(/\/$/, "") || "/";
    const isHome = (path === "/" || path.endsWith("/index.html")) &&
      (normalized === "/" || normalized.endsWith("index.html") || normalized === ".");
    const isMatch =
      isHome ||
      path.endsWith(normalized) ||
      path.endsWith(normalized.replace(/^\//, ""));
    if (isMatch && !isHome && normalized !== "/" && !normalized.endsWith("index.html")) {
      a.setAttribute("aria-current", "page");
    } else if (isHome && (normalized === "/" || normalized.endsWith("index.html") || href === "index.html" || href === "./" || href === "/")) {
      a.setAttribute("aria-current", "page");
    }
  });
}

function yearStamp(): void {
  document.querySelectorAll<HTMLElement>("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

initNav();
markCurrentNav();
yearStamp();
