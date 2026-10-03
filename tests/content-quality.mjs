#!/usr/bin/env node
/**
 * Content-quality checks against the production build (dist/).
 * Ported from movahedi.ca's content-quality.mjs; adapted for mossymesh.com
 * (flat .html pages, no insights collection, no bilingual).
 *
 * Usage: node tests/content-quality.mjs [--json] [--dist path/to/dist]
 *
 * Each rule is a defect that has bitten content sites before:
 *  - canonical that is missing or points elsewhere (SEO killer)
 *  - placeholder text shipped to production (lorem ipsum, TODO, [object Object])
 *  - titles/descriptions so long they truncate in search results (warn)
 *  - JSON-LD that fails to parse (rich results die silently)
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

const suite = createSuite({ name: "content quality", distDir: DIST });
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

/** Canonical URL path for a dist page (what the canonical tag should be). */
function expectedPath(rp) {
  let p = rp.replace(/^dist/, "");
  if (p === "/index.html") return "/";
  // directory index: /blog/index.html -> /blog/ (clean URL)
  if (p.endsWith("/index.html")) return p.slice(0, -"index.html".length);
  return p; // flat .html convention: /developers.html stays /developers.html
}

const PLACEHOLDERS = [
  /lorem ipsum/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\[object Object\]/,
  /\bundefined\b(?=\s*[<.}])/,
];

function runChecks() {
  if (!existsSync(DIST)) {
    check("content/dist-exists", "required", false, {
      detail: `dist/ not found at ${DIST}`,
      expected: "npm run build produces dist/ before QA suites run",
      actual: "dist/ missing",
      hint: "run npm run build first",
    });
    return;
  }

  const pages = htmlPages(DIST);

  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const rp = rel(page);

    // 1. Canonical is present and self-referential
    {
      const m = /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/i.exec(html);
      const want = "https://mossymesh.com" + expectedPath(rp);
      const ok = !!m && m[1].split("?")[0].replace(/\/$/, "") === want.replace(/\/$/, "");
      check("content/canonical-self", "required", ok, {
        path: rp,
        detail: ok ? `canonical=${m[1]}` : m ? `canonical points at ${m[1]}` : "no canonical tag",
        ...(ok ? {} : {
          line: m ? lineOf(html, m.index) : 1,
          snippet: m ? excerpt(html, m.index, 1) : excerpt(html, 0, 3),
          expected: `canonical href="${want}"`,
          actual: m ? `canonical href="${m[1]}"` : "missing <link rel=canonical>",
          hint: "set the canonical to the page's own public URL in the page head",
        }),
      });
    }

    // 2. No placeholder text shipped to production
    {
      // strip scripts/styles: placeholders inside code are not visible copy
      const visible = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
      let hit = null;
      for (const re of PLACEHOLDERS) {
        const m = re.exec(visible);
        if (m) { hit = m; break; }
      }
      const ok = !hit;
      check("content/no-placeholder-text", "required", ok, {
        path: rp,
        detail: ok ? "no placeholder copy" : `placeholder text: ${hit[0].slice(0, 40)}`,
        ...(ok ? {} : {
          line: lineOf(visible, hit.index),
          snippet: excerpt(visible, hit.index, 1),
          expected: "production copy, no lorem ipsum / TODO / [object Object]",
          actual: `found "${hit[0].slice(0, 60)}" in rendered output`,
          hint: "finish or remove the draft copy before publishing",
        }),
      });
    }

    // 3. Title length (warn: truncates in SERPs past ~60-70 chars)
    {
      const m = /<title>([^<]*)<\/title>/i.exec(html);
      const len = m ? m[1].trim().length : 0;
      const ok = len > 0 && len <= 70;
      check("content/title-length", "expected", ok, {
        path: rp,
        detail: ok ? `title ${len} chars` : `title ${len} chars (truncates in search results)`,
        ...(ok ? {} : {
          expected: "title between 1 and 70 characters",
          actual: `${len} characters: ${(m ? m[1].trim() : "").slice(0, 80)}`,
          hint: "front-load keywords; move the rest into the meta description",
        }),
      });
    }

    // 4. Meta description length (warn: truncates past ~160 chars)
    {
      const m = /<meta\b[^>]*name="description"[^>]*content="([^"]*)"/i.exec(html);
      const len = m ? m[1].length : 0;
      const ok = !!m && len >= 50 && len <= 160;
      check("content/description-length", "expected", ok, {
        path: rp,
        detail: !m ? "no meta description" : ok ? `description ${len} chars` : `description ${len} chars`,
        ...(ok ? {} : {
          expected: "meta description present, 50-160 characters",
          actual: !m ? "missing meta description" : `${len} characters`,
          hint: "write a 50-160 char summary of the page's value",
        }),
      });
    }

    // 5. JSON-LD parses (only where JSON-LD is present)
    {
      const blocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
      if (!blocks.length) {
        check("content/jsonld-parses", "expected", true, { path: rp, detail: "no JSON-LD on page (optional)" });
      } else {
        let bad = -1; let err = "";
        for (const b of blocks) {
          try { JSON.parse(b[1]); } catch (e) { bad = b.index; err = String(e).split("\n")[0]; break; }
        }
        const ok = bad < 0;
        check("content/jsonld-parses", "required", ok, {
          path: rp,
          detail: ok ? `${blocks.length} JSON-LD block(s) parse` : `JSON-LD parse error: ${err}`,
          ...(ok ? {} : {
            line: lineOf(html, bad),
            snippet: excerpt(html, bad, 2),
            expected: "valid JSON in application/ld+json blocks",
            actual: err,
            hint: "check for unescaped quotes or trailing commas in the schema",
          }),
        });
      }
    }
  }
}

runChecks();
suite.run();
