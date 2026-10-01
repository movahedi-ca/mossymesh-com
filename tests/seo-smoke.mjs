#!/usr/bin/env node
/**
 * SEO smoke checks against the production build output (dist/).
 * Ported from movahedi.ca's seo-smoke.mjs; adapted for mossymesh.com
 * (flat .html pages, single sitemap.xml, no CMS/admin, no insights/blog,
 * no bilingual, static /api/ JSON instead of a Worker API).
 *
 * Prerequisites:
 *   npm run build   # or ensure dist/ already exists from a recent build
 *
 * Usage:
 *   node tests/seo-smoke.mjs
 *   node tests/seo-smoke.mjs --json
 *   node tests/seo-smoke.mjs --dist path/to/dist
 *
 * Exit 0 if no required failures; exit 1 if required items fail or dist/ is missing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const asJson = process.argv.includes("--json");

/** @typedef {"required" | "expected" | "optional"} Severity */

/**
 * @typedef {object} Result
 * @property {string} id
 * @property {Severity} severity
 * @property {boolean} ok
 * @property {string} detail
 * @property {string} [note]
 * @property {string} [path]
 */

const SITE = "https://mossymesh.com";

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const distArg = argValue("--dist");
const DIST = distArg
  ? distArg.startsWith("/") || /^[A-Za-z]:/.test(distArg)
    ? distArg
    : join(process.cwd(), distArg)
  : join(ROOT, "dist");

/**
 * @param {string} abs
 * @returns {string}
 */
function readText(abs) {
  return readFileSync(abs, "utf8");
}

/**
 * @param {string} abs
 * @returns {boolean}
 */
function isFile(abs) {
  return existsSync(abs) && statSync(abs).isFile();
}

/**
 * Extract the first <head>...</head> block (case-insensitive). Falls back to
 * full HTML if no head (minified builds always have one).
 * @param {string} html
 */
function headSection(html) {
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : html;
}

/**
 * @param {string} html
 * @param {string} tag  e.g. title
 */
function tagText(html, tag) {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim();
}

/**
 * Attribute value for first matching meta/link by name|property|rel.
 * @param {string} html
 * @param {"name"|"property"|"rel"} attr
 * @param {string} key
 * @param {string} [valueAttr="content"]
 */
function metaContent(html, attr, key, valueAttr = "content") {
  const re = new RegExp(
    `<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${escapeRe(key)}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;
  const tag = m[0];
  const vm = tag.match(new RegExp(`\\b${valueAttr}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return vm ? vm[2] : null;
}

/**
 * @param {string} html
 * @param {string} rel
 */
function linkHref(html, rel) {
  const re = new RegExp(
    `<link\\b[^>]*\\brel\\s*=\\s*["']${escapeRe(rel)}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;
  const hm = m[0].match(/\bhref\s*=\s*["']([^"']*)["']/i);
  return hm ? hm[1] : null;
}

/**
 * @param {string} s
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} html
 * @returns {boolean}
 */
function hasJsonLd(html) {
  return /<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html);
}

/** @param {string} rel */
function expectedCanonicalFor(rel) {
  // mossymesh.com convention: flat .html files, /index.html -> trailing slash
  return rel === "index.html" ? `${SITE}/` : `${SITE}/${rel}`;
}

/**
 * Map a sitemap <loc> URL to a dist file.
 * @param {string} loc
 * @returns {string | null}
 */
function resolveLoc(loc) {
  let u;
  try {
    u = new URL(loc).pathname;
  } catch {
    return null;
  }
  const cands = [join(DIST, u, "index.html"), join(DIST, u + ".html"), join(DIST, u)];
  for (const c of cands) {
    if (isFile(c)) return c;
  }
  return null;
}

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const stat = statSync(abs);
    if (stat.isDirectory()) files.push(...htmlFiles(abs));
    else if (name.endsWith(".html")) files.push(abs);
  }
  return files;
}

/**
 * @returns {Result[]}
 */
function runChecks() {
  /** @type {Result[]} */
  const results = [];

  const push = (/** @type {Omit<Result, "ok"> & { ok: boolean }} */ r) => {
    results.push(r);
  };

  if (!existsSync(DIST) || !statSync(DIST).isDirectory()) {
    push({
      id: "dist-present",
      severity: "required",
      ok: false,
      detail: `MISSING dist/ at ${DIST}`,
      note: "Run `npm run build` first, then re-run this script",
      path: relative(ROOT, DIST),
    });
    return results;
  }

  push({
    id: "dist-present",
    severity: "required",
    ok: true,
    detail: `dist/ found (${relative(process.cwd(), DIST) || "dist"})`,
    path: relative(ROOT, DIST),
  });

  // ── robots.txt ──────────────────────────────────────────────
  const robotsPath = join(DIST, "robots.txt");
  if (!isFile(robotsPath)) {
    push({
      id: "robots-file",
      severity: "required",
      ok: false,
      detail: "MISSING robots.txt",
      path: "dist/robots.txt",
    });
  } else {
    const robots = readText(robotsPath);
    push({
      id: "robots-file",
      severity: "required",
      ok: true,
      detail: "present",
      path: "dist/robots.txt",
    });

    const hasSitemap = /^\s*Sitemap\s*:/im.test(robots);
    push({
      id: "robots-sitemap",
      severity: "required",
      ok: hasSitemap,
      detail: hasSitemap
        ? (robots.match(/^\s*Sitemap\s*:\s*(.+)$/im)?.[1]?.trim() ?? "Sitemap present")
        : "no Sitemap: directive",
      path: "dist/robots.txt",
    });

    const sitemapPointsHome =
      hasSitemap && new RegExp(`Sitemap:\\s*${escapeRe(SITE)}/sitemap\\.xml`, "i").test(robots);
    push({
      id: "robots-sitemap-canonical",
      severity: "expected",
      ok: sitemapPointsHome,
      detail: sitemapPointsHome ? `Sitemap: ${SITE}/sitemap.xml` : "Sitemap directive does not point at the canonical sitemap",
      path: "dist/robots.txt",
    });

    // Site crawl not blanket-blocked. (CRLF-safe.)
    const allowsRoot =
      /Allow\s*:\s*\/\s*$/im.test(robots.replace(/\r\n/g, "\n")) ||
      !/Disallow\s*:\s*\/\s*$/im.test(robots.replace(/\r\n/g, "\n"));
    push({
      id: "robots-allows-site",
      severity: "required",
      ok: allowsRoot,
      detail: allowsRoot ? "site crawl not blanket-blocked" : "root may be disallowed",
      path: "dist/robots.txt",
    });
  }

  // ── sitemap.xml ─────────────────────────────────────────────
  const sitemapPath = join(DIST, "sitemap.xml");
  if (!isFile(sitemapPath)) {
    push({
      id: "sitemap-present",
      severity: "required",
      ok: false,
      detail: "MISSING sitemap.xml",
      path: "dist/sitemap.xml",
    });
  } else {
    const sm = readText(sitemapPath);
    const locs = [...sm.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1].trim());
    push({
      id: "sitemap-present",
      severity: "required",
      ok: true,
      detail: `${locs.length} URL(s) listed`,
      path: "dist/sitemap.xml",
    });

    const homeListed = locs.some((l) => l === `${SITE}/` || l === SITE);
    push({
      id: "sitemap-includes-home",
      severity: "required",
      ok: homeListed,
      detail: homeListed ? `${SITE}/ listed` : "homepage not in sitemap",
      path: "dist/sitemap.xml",
    });

    let broken = 0;
    for (const loc of locs) {
      if (!resolveLoc(loc)) broken++;
    }
    push({
      id: "sitemap-urls-resolve",
      severity: "required",
      ok: broken === 0,
      detail: broken === 0 ? "every sitemap URL resolves to a dist file" : `${broken} sitemap URL(s) match nothing in dist/`,
      path: "dist/sitemap.xml",
    });

    // Every built HTML page should be in the sitemap (small site: no orphans).
    const pageRels = htmlFiles(DIST).map((f) => relative(DIST, f).replaceAll("\\", "/"));
    const orphanPages = pageRels.filter(
      (r) => !locs.includes(expectedCanonicalFor(r)),
    );
    push({
      id: "sitemap-covers-pages",
      severity: "expected",
      ok: orphanPages.length === 0,
      detail: orphanPages.length === 0 ? "all built pages listed" : `not listed: ${orphanPages.join(", ")}`,
      path: "dist/sitemap.xml",
    });
  }

  // ── home index.html ─────────────────────────────────────────
  const homePath = join(DIST, "index.html");
  if (!isFile(homePath)) {
    push({
      id: "home-html",
      severity: "required",
      ok: false,
      detail: "MISSING dist/index.html",
      path: "dist/index.html",
    });
  } else {
    const home = readText(homePath);
    const head = headSection(home);

    push({ id: "home-html", severity: "required", ok: true, detail: "present", path: "dist/index.html" });

    const title = tagText(head, "title");
    push({
      id: "home-title",
      severity: "required",
      ok: Boolean(title && title.length > 0),
      detail: title ? truncate(title, 80) : "MISSING <title>",
      path: "dist/index.html",
    });

    const desc = metaContent(head, "name", "description");
    push({
      id: "home-meta-description",
      severity: "required",
      ok: Boolean(desc && desc.length > 20),
      detail: desc ? truncate(desc, 100) : "MISSING meta description",
      path: "dist/index.html",
    });

    const canonical = linkHref(head, "canonical");
    push({
      id: "home-canonical",
      severity: "required",
      ok: canonical === `${SITE}/`,
      detail: canonical ?? "MISSING link rel=canonical",
      path: "dist/index.html",
      note: `expected ${SITE}/`,
    });

    const ogTitle = metaContent(head, "property", "og:title");
    push({
      id: "home-og-title",
      severity: "required",
      ok: Boolean(ogTitle && ogTitle.length > 0),
      detail: ogTitle ? truncate(ogTitle, 80) : "MISSING og:title",
      path: "dist/index.html",
    });

    const ogUrl = metaContent(head, "property", "og:url");
    push({
      id: "home-og-url",
      severity: "expected",
      ok: ogUrl === `${SITE}/`,
      detail: ogUrl ?? "MISSING og:url",
      path: "dist/index.html",
      note: `expected ${SITE}/`,
    });

    // JSON-LD is a gap, not a defect: reported, never fails.
    const ld = hasJsonLd(home);
    push({
      id: "home-jsonld",
      severity: "expected",
      ok: ld,
      detail: ld ? "application/ld+json present" : "no JSON-LD on home yet (Organization/WebSite graph recommended)",
      path: "dist/index.html",
    });

    // Home should be indexable
    const robotsMeta = metaContent(head, "name", "robots") ?? "";
    const homeNoindex = /noindex/i.test(robotsMeta);
    push({
      id: "home-indexable",
      severity: "required",
      ok: !homeNoindex,
      detail: homeNoindex ? `unexpected noindex: ${robotsMeta}` : robotsMeta || "no robots meta (default index)",
      path: "dist/index.html",
    });
  }

  // ── per-page metadata hygiene ──────────────────────────────
  const metadataFiles = htmlFiles(DIST);
  const titles = new Map();
  const descriptions = new Map();
  for (const file of metadataFiles) {
    const rel = relative(DIST, file).replaceAll("\\", "/");
    const html = readText(file);
    const head = headSection(html);
    const title = tagText(head, "title") ?? "";
    const description = metaContent(head, "name", "description") ?? "";
    const canonical = linkHref(head, "canonical") ?? "";
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const robotsMeta = metaContent(head, "name", "robots") ?? "";
    titles.set(title, (titles.get(title) || 0) + 1);
    descriptions.set(description, (descriptions.get(description) || 0) + 1);
    push({
      id: `metadata-${rel}-complete`,
      severity: "required",
      ok: Boolean(title && description && canonical && h1Count === 1),
      detail: `title=${Boolean(title)} description=${Boolean(description)} canonical=${Boolean(canonical)} h1=${h1Count}`,
      path: `dist/${rel}`,
    });
    push({
      id: `crawlability-${rel}`,
      severity: "required",
      ok: !/noindex/i.test(robotsMeta),
      detail: robotsMeta || "index, follow (default)",
      path: `dist/${rel}`,
    });
    push({
      id: `canonical-${rel}`,
      severity: "required",
      ok: canonical === expectedCanonicalFor(rel),
      detail: canonical || "MISSING canonical",
      path: `dist/${rel}`,
      note: `expected ${expectedCanonicalFor(rel)}`,
    });
  }
  const duplicateTitles = [...titles.entries()].filter(([value, count]) => value && count > 1);
  const duplicateDescriptions = [...descriptions.entries()].filter(([value, count]) => value && count > 1);
  push({
    id: "metadata-unique-titles",
    severity: "required",
    ok: duplicateTitles.length === 0,
    detail: duplicateTitles.length
      ? duplicateTitles.map(([title, count]) => `${count}x ${truncate(title, 80)}`).join("; ")
      : "all titles are unique",
    path: "dist/**/*.html",
  });
  push({
    id: "metadata-unique-descriptions",
    severity: "required",
    ok: duplicateDescriptions.length === 0,
    detail: duplicateDescriptions.length
      ? duplicateDescriptions.map(([description, count]) => `${count}x ${truncate(description, 100)}`).join("; ")
      : "all descriptions are unique",
    path: "dist/**/*.html",
  });

  // ── openapi.yaml ────────────────────────────────────────────
  const openapiPath = join(DIST, "openapi.yaml");
  if (!isFile(openapiPath)) {
    push({
      id: "openapi-file",
      severity: "expected",
      ok: false,
      detail: "MISSING openapi.yaml",
      path: "dist/openapi.yaml",
    });
  } else {
    const spec = readText(openapiPath);
    const looksValid = /^openapi:\s*["']?3\./im.test(spec) && /\/api\/v1\//m.test(spec);
    push({
      id: "openapi-file",
      severity: "expected",
      ok: looksValid,
      detail: looksValid ? "OpenAPI 3.x doc with /api/v1 paths" : "openapi.yaml does not look like a valid OpenAPI 3 spec",
      path: "dist/openapi.yaml",
    });
  }

  // ── llms.txt (nice-to-have for AI crawlers) ──────────────────
  const llms = join(DIST, "llms.txt");
  if (!isFile(llms)) {
    push({
      id: "llms-txt",
      severity: "expected",
      ok: false,
      detail: "MISSING llms.txt",
      path: "dist/llms.txt",
    });
  } else {
    const text = readText(llms);
    const ok = text.length > 100 && new RegExp(escapeRe("mossymesh.com"), "i").test(text);
    push({
      id: "llms-txt",
      severity: "expected",
      ok,
      detail: ok ? `${text.length} chars, mentions mossymesh.com` : "llms.txt is empty or off-brand",
      path: "dist/llms.txt",
    });
  }

  return results;
}

/**
 * @param {string} s
 * @param {number} n
 */
function truncate(s, n) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function main() {
  const all = runChecks();
  const failedRequired = all.filter((r) => !r.ok && r.severity === "required");
  const failedExpected = all.filter((r) => !r.ok && r.severity === "expected");
  const failedOptional = all.filter((r) => !r.ok && r.severity === "optional");
  const passed = all.filter((r) => r.ok);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          root: ROOT,
          dist: DIST,
          summary: {
            total: all.length,
            passed: passed.length,
            failedRequired: failedRequired.length,
            failedExpected: failedExpected.length,
            failedOptional: failedOptional.length,
          },
          results: all,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`mossymesh.com SEO smoke – dist: ${relative(process.cwd(), DIST) || "dist"}\n`);

    /**
     * @param {string} title
     * @param {Result[]} items
     * @param {string} symbol
     */
    const printGroup = (title, items, symbol) => {
      if (!items.length) return;
      console.log(title);
      for (const r of items) {
        const pathBit = r.path ? `  ${r.path}` : "";
        const note = r.note ? `  [${r.note}]` : "";
        console.log(`  ${symbol} ${r.id}${pathBit}  – ${r.detail}${note}`);
      }
      console.log("");
    };

    printGroup("PASS", passed, "✓");
    printGroup("FAIL required", failedRequired, "✗");
    printGroup("MISSING expected (SEO gaps)", failedExpected, "!");
    printGroup("MISSING optional", failedOptional, "·");

    console.log("── Summary ──");
    console.log(
      `  ${passed.length} passed · ${failedRequired.length} required fail · ${failedExpected.length} expected missing · ${failedOptional.length} optional missing`,
    );
    if (failedRequired.length) {
      console.log("  Result: FAIL (required SEO checks)");
    } else if (failedExpected.length) {
      console.log("  Result: PASS with gaps (expected SEO improvements remaining)");
    } else {
      console.log("  Result: PASS");
    }
  }

  process.exit(failedRequired.length ? 1 : 0);
}

main();
