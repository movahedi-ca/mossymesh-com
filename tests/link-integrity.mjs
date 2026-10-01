#!/usr/bin/env node
/**
 * Internal link-integrity checks against the production build (dist/).
 * Ported from movahedi.ca's link-integrity.mjs.
 *
 * Usage: node tests/link-integrity.mjs [--json] [--dist path/to/dist]
 *
 * Differences from the movahedi.ca original: /api/ is NOT exempt here.
 * mossymesh.com ships /api/ as static JSON files in dist/, so every
 * internal href must resolve to a built file or a non-empty directory.
 *
 * Two rules:
 *  - every distinct internal href on a page resolves to a built file
 *    (required; deduped per page so nav links count once)
 *  - #fragment anchors resolve to an id on the target page (expected;
 *    JS-rendered ids can legitimately be absent from static HTML)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createSuite, lineOf, excerpt } from "./lib/diag.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}
const DIST = argValue("--dist") || join(ROOT, "dist");
const rel = (p) => relative(ROOT, p) || p;

const suite = createSuite({ name: "internal link integrity", distDir: DIST });
const { check } = suite;

function htmlPages(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...htmlPages(p));
    else if (e.endsWith(".html")) out.push(p);
  }
  return out.sort();
}

/** Files inside a directory, non-recursive. */
function dirFileCount(dir) {
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

function isInternal(href) {
  if (!href || href.startsWith("#")) return false;
  if (/^(mailto|tel|sms):/i.test(href)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return false; // absolute URL incl. //
  if (href.startsWith("//")) return false; // protocol-relative: external
  return href.startsWith("/");
}

/** Map an internal href to a dist file or non-empty dir, else null. */
function resolveInternal(href) {
  const u = href.split("#")[0].split("?")[0];
  if (!u) return null;
  const cands = [join(DIST, u, "index.html"), join(DIST, u + ".html"), join(DIST, u)];
  for (const c of cands) {
    try {
      const st = statSync(c);
      if (st.isFile()) return c;
      // A bare /api/ directory that ships JSON counts as a resolved
      // endpoint listing only when it is non-empty.
      if (st.isDirectory() && u.startsWith("/api") && dirFileCount(c) > 0) return c;
    } catch { /* ignore */ }
  }
  return null;
}

/** All id="..." values in an HTML file. */
function idsIn(file) {
  try {
    const html = readFileSync(file, "utf8");
    return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

function runChecks() {
  if (!existsSync(DIST)) {
    check("link/dist-exists", "required", false, {
      detail: `dist/ not found at ${DIST}`,
      expected: "npm run build produces dist/ before QA suites run",
      actual: "dist/ missing",
      hint: "run npm run build first",
    });
    return;
  }

  const pages = htmlPages(DIST);
  const idCache = new Map();
  const idsOf = (f) => {
    if (!idCache.has(f)) idCache.set(f, idsIn(f));
    return idCache.get(f);
  };

  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const rp = rel(page);

    // distinct internal hrefs on this page (dedupe: nav repeats don't re-count)
    const seen = new Map();
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (isInternal(m[1]) && !seen.has(m[1])) seen.set(m[1], m.index);
    }

    for (const [href, idx] of seen) {
      const target = resolveInternal(href);
      const ok = target !== null;
      check("link/internal-resolves", "required", ok, {
        path: rp,
        detail: ok ? `${href} -> ${rel(target)}` : `broken internal link: ${href}`,
        ...(ok ? {} : {
          line: lineOf(html, idx),
          snippet: excerpt(html, idx, 1),
          expected: "internal href resolves to a built file or non-empty /api/ dir",
          actual: `${href} matches nothing in dist/`,
          hint: "fix the slug (page renamed/moved?) or remove the link",
        }),
      });

      // fragment anchors (skip hash-routed SPA links like #/scenario/x: not element ids)
      const frag = href.split("#")[1];
      if (ok && frag && !frag.startsWith("/")) {
        let anchorOk;
        try {
          anchorOk = statSync(target).isFile() && idsOf(target).has(decodeURIComponent(frag));
        } catch {
          anchorOk = false;
        }
        check("link/anchor-resolves", "expected", anchorOk, {
          path: rp,
          detail: anchorOk ? `${href} anchor #${frag} exists` : `#${frag} not found on ${rel(target)}`,
          ...(anchorOk ? {} : {
            line: lineOf(html, idx),
            snippet: excerpt(html, idx, 1),
            expected: `id="${frag}" present on the target page`,
            actual: `no id="${frag}" in ${rel(target)}`,
            hint: "fix the anchor name, or confirm the id is rendered client-side",
          }),
        });
      }
    }
  }
}

runChecks();
suite.run();
