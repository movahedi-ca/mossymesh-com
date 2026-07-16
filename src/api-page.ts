/**
 * API page: fetch live /api/v1/project.json (+ endpoints catalog) when available.
 */

import "./main";

export interface SlaItem {
  id?: string;
  name?: string;
  target?: string;
  bytes_max?: number;
}

export interface EndpointInfo {
  method?: string;
  path: string;
  summary?: string;
  description?: string;
  status?: string;
  kind?: string;
}

export interface ProjectJson {
  name?: string;
  version?: string;
  description?: string;
  mission?: string;
  tagline?: string;
  website?: string;
  domain?: string;
  repository?: string;
  openapi?: string;
  status?: string;
  also_known_as?: string[];
  slas?: SlaItem[] | Record<string, string | number>;
  endpoints?: EndpointInfo[];
  github?: { product?: string; site?: string };
  links?: Record<string, string>;
  phase_summary?: {
    current_workspace?: string;
    phases?: number;
    labels?: string[];
    detail?: string;
  };
  poc?: {
    name?: string;
    engine?: string;
    target_mnps?: number;
    purpose?: string;
  };
  [key: string]: unknown;
}

const FALLBACK_ENDPOINTS: EndpointInfo[] = [
  {
    method: "GET",
    path: "/api/v1/project.json",
    summary: "Project metadata",
    description: "Name, mission, SLAs, GitHub, phase summary.",
    status: "site",
  },
  {
    method: "GET",
    path: "/api/v1/health.json",
    summary: "Static health",
    description: "CDN liveness when the file is served.",
    status: "site",
  },
  {
    method: "GET",
    path: "/api/v1/health",
    summary: "Live health",
    description: "Pages Function health (timestamp when deployed).",
    status: "site",
  },
  {
    method: "GET",
    path: "/api/v1/phases.json",
    summary: "Roadmap phases 1–5",
    description: "Transport → Sandbox → Consensus → Logic → Interop.",
    status: "site",
  },
  {
    method: "GET",
    path: "/api/v1/stack.json",
    summary: "Architecture stack",
    description: "Layers and core technologies.",
    status: "site",
  },
  {
    method: "GET",
    path: "/api/v1/endpoints.json",
    summary: "Endpoint catalog",
    description: "Site meta + planned mesh gateway routes.",
    status: "site",
  },
  {
    method: "GET",
    path: "/openapi.yaml",
    summary: "OpenAPI 3.x",
    description: "Machine-readable gateway + site contract.",
    status: "site",
  },
  {
    method: "POST",
    path: "/api/v1/submit_job",
    summary: "Submit compute job",
    description: "Enqueue a job into the mesh (VDF-gated Job DID).",
    status: "gateway",
  },
  {
    method: "GET",
    path: "/api/v1/twamm",
    summary: "TWAMM book status",
    description: "Max spread 200 bps (2%).",
    status: "gateway",
  },
  {
    method: "POST",
    path: "/api/v1/twamm",
    summary: "Submit TWAMM order",
    description: "Stream / place order with 2% max-spread cap.",
    status: "gateway",
  },
  {
    method: "GET",
    path: "/api/v1/liquidity",
    summary: "Liquidity mining status",
    description: "Genesis offline mining aggregate.",
    status: "gateway",
  },
  {
    method: "POST",
    path: "/api/v1/liquidity",
    summary: "Liquidity action",
    description: "register | accrue | claim | get | status.",
    status: "gateway",
  },
  {
    method: "GET",
    path: "/api/v1/gateway",
    summary: "OpenAPI gateway status",
    description: "Active only after internet reconnect.",
    status: "gateway",
  },
  {
    method: "POST",
    path: "/api/v1/gateway",
    summary: "Gateway action",
    description: "reconnect | disconnect | bridge | status.",
    status: "gateway",
  },
];

const FALLBACK: ProjectJson = {
  name: "MossyMesh",
  also_known_as: ["MessyMash"],
  domain: "https://mossymesh.com",
  tagline:
    "Asynchronous, censorship-resistant, serverless supercomputer & open-source chess PoC",
  mission:
    "Build a self-healing mesh that turns phones, Raspberry Pis, PCs, and LoRa radios into a unified, decentralized compute grid operating independently of traditional ISPs, DNS servers, and fiat currencies.",
  description:
    "Decentralized offline compute mesh — identity-routed, deterministic WASM jobs, ≤10 MB edge ledger.",
  status: "static-fallback",
  github: {
    product: "https://github.com/movahedi-ca/MossyMesh",
    site: "https://github.com/movahedi-ca/mossymesh-com",
  },
  links: {
    openapi: "/openapi.yaml",
    api_catalog: "/api/index.json",
    docs_human: "/developers.html",
  },
  slas: [
    { id: "SLA-RAM", name: "Edge ledger footprint", target: "≤ 10 MB active ledger on edge devices" },
    { id: "SLA-DET", name: "Determinism", target: "< 1% unverifiable outputs" },
    { id: "SLA-TO", name: "Job reliability", target: "< 5% job timeout in unstable RF" },
    { id: "SLA-DEC", name: "Decentralization", target: "No centralized DNS/IP/cloud DB control plane" },
  ],
  endpoints: FALLBACK_ENDPOINTS,
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(mode: "live" | "fallback" | "error", message: string): void {
  const dot = document.querySelector("[data-api-dot]");
  const text = document.querySelector("[data-api-status-text]");
  if (!dot || !text) return;
  dot.classList.remove("live", "fallback", "error");
  dot.classList.add(mode);
  text.textContent = message;
}

function formatSlas(slas: ProjectJson["slas"]): HTMLElement | null {
  if (!slas) return null;
  const list = el("ul");
  list.style.margin = "0.75rem 0 0";
  list.style.paddingLeft = "1.1rem";
  list.style.color = "var(--text-muted)";

  if (Array.isArray(slas)) {
    for (const item of slas) {
      const li = el("li");
      const label = item.id ?? item.name ?? "SLA";
      const target = item.target ?? "";
      li.innerHTML = `<span class="mono">${escapeHtml(label)}</span> — ${escapeHtml(target)}`;
      list.append(li);
    }
  } else {
    for (const [k, v] of Object.entries(slas)) {
      const li = el("li");
      li.innerHTML = `<span class="mono">${escapeHtml(k)}</span>: ${escapeHtml(String(v))}`;
      list.append(li);
    }
  }
  return list;
}

function renderProjectMeta(data: ProjectJson): void {
  const root = document.querySelector("[data-project-meta]");
  if (!root) return;
  root.replaceChildren();

  const title = el("h3", undefined, data.name ?? "MossyMesh");
  const aka =
    data.also_known_as && data.also_known_as.length > 0
      ? el("p", "muted", `Also known as: ${data.also_known_as.join(", ")}`)
      : null;
  const desc = el(
    "p",
    undefined,
    data.mission ?? data.description ?? data.tagline ?? "",
  );
  const meta = el("p", "muted mono");
  const bits: string[] = [];
  if (data.version) bits.push(`v${data.version}`);
  if (data.status) bits.push(String(data.status));
  if (data.domain) bits.push(String(data.domain));
  if (data.website) bits.push(String(data.website));
  if (data.github?.product) bits.push(data.github.product);
  if (data.phase_summary?.current_workspace) {
    bits.push(data.phase_summary.current_workspace);
  }
  meta.textContent = bits.join(" · ");

  root.append(title);
  if (aka) root.append(aka);
  root.append(desc, meta);

  if (data.poc) {
    const poc = el(
      "p",
      undefined,
      `PoC: ${data.poc.name ?? "chess"} (${data.poc.engine ?? "shakmaty"})` +
        (data.poc.target_mnps ? ` · ~${data.poc.target_mnps} Mnps class` : "") +
        (data.poc.purpose ? ` — ${data.poc.purpose}` : ""),
    );
    poc.style.marginTop = "0.75rem";
    root.append(poc);
  }

  const slaList = formatSlas(data.slas);
  if (slaList) root.append(slaList);

  const openapi = data.links?.openapi ?? data.openapi ?? "/openapi.yaml";
  const linkP = el("p", "mono");
  linkP.style.marginTop = "0.85rem";
  linkP.innerHTML = `OpenAPI: <a href="${escapeHtml(openapi)}">${escapeHtml(openapi)}</a>`;
  root.append(linkP);
}

function renderEndpoints(endpoints: EndpointInfo[]): void {
  const root = document.querySelector("[data-endpoint-list]");
  if (!root) return;
  root.replaceChildren();

  for (const ep of endpoints) {
    const row = el("article", "endpoint");
    const methodClass =
      ep.method?.toUpperCase().includes("POST") && !ep.method.toUpperCase().includes("GET")
        ? "method post"
        : "method";
    const method = el("span", methodClass);
    method.textContent = (ep.method ?? "GET").toUpperCase();

    const body = el("div");
    const path = el("div", "endpoint-path", ep.path);
    const desc = el("div", "endpoint-desc", ep.summary ?? ep.description ?? "");
    body.append(path, desc);

    const meta = el("div", "endpoint-meta", ep.status ?? ep.kind ?? "");
    row.append(method, body, meta);
    root.append(row);
  }
}

function renderRaw(data: unknown): void {
  const pre = document.querySelector("[data-project-json]");
  if (!pre) return;
  pre.textContent = JSON.stringify(data, null, 2);
}

function catalogToEndpoints(catalog: unknown): EndpointInfo[] {
  if (!catalog || typeof catalog !== "object") return [];
  const c = catalog as Record<string, unknown>;
  const out: EndpointInfo[] = [];

  const pushArr = (arr: unknown, status: string) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const e = item as Record<string, unknown>;
      if (typeof e.path !== "string") continue;
      out.push({
        method: typeof e.method === "string" ? e.method : "GET",
        path: e.path,
        summary: typeof e.description === "string" ? e.description : undefined,
        description: typeof e.description === "string" ? e.description : undefined,
        status: typeof e.status === "string" ? e.status : status,
        kind: typeof e.kind === "string" ? e.kind : undefined,
      });
    }
  };

  pushArr(c.site_meta_api, "site");
  pushArr(c.mesh_gateway, "gateway");
  pushArr(c.gateway, "gateway");
  pushArr(c.endpoints, "api");

  // Also surface HTML pages lightly
  if (Array.isArray(c.site_pages)) {
    for (const item of c.site_pages) {
      if (!item || typeof item !== "object") continue;
      const e = item as Record<string, unknown>;
      if (typeof e.path !== "string") continue;
      out.push({
        method: typeof e.method === "string" ? e.method : "GET",
        path: e.path,
        summary: typeof e.description === "string" ? e.description : undefined,
        status: "page",
        kind: typeof e.kind === "string" ? e.kind : "html",
      });
    }
  }

  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function loadProject(): Promise<void> {
  try {
    const project = (await fetchJson("/api/v1/project.json")) as ProjectJson;
    let endpoints = FALLBACK_ENDPOINTS;
    let endpointsSource = "fallback catalog";

    try {
      const catalog = await fetchJson("/api/v1/endpoints.json");
      const fromCatalog = catalogToEndpoints(catalog);
      if (fromCatalog.length > 0) {
        endpoints = fromCatalog;
        endpointsSource = "/api/v1/endpoints.json";
      }
    } catch {
      if (Array.isArray(project.endpoints) && project.endpoints.length > 0) {
        endpoints = project.endpoints;
        endpointsSource = "project.endpoints";
      }
    }

    const merged: ProjectJson = {
      ...FALLBACK,
      ...project,
      endpoints,
    };

    setStatus(
      "live",
      `Live data from /api/v1/project.json · endpoints from ${endpointsSource}`,
    );
    renderProjectMeta(merged);
    renderEndpoints(endpoints);
    renderRaw(project);
  } catch {
    setStatus(
      "fallback",
      "Live /api/v1/project.json unavailable — showing static fallback.",
    );
    renderProjectMeta(FALLBACK);
    renderEndpoints(FALLBACK_ENDPOINTS);
    renderRaw(FALLBACK);
  }
}

void loadProject();
