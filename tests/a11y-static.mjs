#!/usr/bin/env node
/**
 * Static accessibility checks against the production build output (dist/).
 *
 * Prerequisites: npm run build (or a recent dist/).
 * Usage: node tests/a11y-static.mjs [--json] [--dist path/to/dist]
 *
 * Every failure carries the file, line number, offending snippet, what was
 * expected, what was found, and a fix hint, so a future diagnosis run can
 * pinpoint the defect without re-reading the page.
 *
 * Severity: required = definite a11y defect, fails the CI job.
 *           expected = best-practice gap, reported, never fails the job.
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

const suite = createSuite({ name: "static accessibility", distDir: DIST });
const { check } = suite;

/** All rendered HTML pages under dist. */
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

/** Character spans of <label>...</label> blocks in html. */
function labelSpans(html) {
  const spans = [];
  const re = /<label\b[^>]*>([\s\S]*?)<\/label>/gi;
  let m;
  while ((m = re.exec(html))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

/** Ids referenced by <label for="...">. */
function labelFors(html) {
  const ids = new Set();
  const re = /<label\b[^>]*\sfor="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  return ids;
}

function runChecks() {
  if (!existsSync(DIST)) {
    check("a11y/dist-exists", "required", false, {
      detail: `dist/ not found at ${DIST}`,
      expected: "npm run build produces dist/ before QA suites run",
      actual: "dist/ missing",
      hint: "run npm run build first (the CI workflow builds before this suite)",
    });
    return;
  }

  const pages = htmlPages(DIST);

  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const rp = rel(page);
    const labels = labelSpans(html);
    const fors = labelFors(html);
    const insideLabel = (idx) => labels.some(([a, b]) => idx >= a && idx < b);

    // 1. <html lang>
    {
      const m = /<html\b[^>]*\slang="([^"]*)"/i.exec(html);
      const ok = !!m && m[1].length >= 2;
      check("a11y/html-lang", "required", ok, {
        path: rp, detail: ok ? `<html lang="${m[1]}">` : "missing <html lang>",
        ...(ok ? {} : {
          line: 1,
          snippet: excerpt(html, 0, 1),
          expected: '<html> carries lang="en" or lang="fr"',
          actual: "no lang attribute on <html>",
          hint: 'add lang="en" (or "fr") to the <html> tag in the base layout',
        }),
      });
    }

    // 2. Non-empty <title>
    {
      const m = /<title>([^<]*)<\/title>/i.exec(html);
      const ok = !!m && m[1].trim().length >= 3;
      check("a11y/page-title", "required", ok, {
        path: rp, detail: ok ? `title: ${m[1].trim().slice(0, 60)}` : "missing/empty <title>",
        ...(ok ? {} : {
          expected: "every page has a descriptive <title>",
          actual: m ? "empty <title>" : "no <title> element",
          hint: "set a unique descriptive title per page in the frontmatter/layout",
        }),
      });
    }

    // 3. Exactly one <h1>
    {
      const hs = [...html.matchAll(/<h1[\s>]/gi)];
      const ok = hs.length === 1;
      check("a11y/single-h1", "required", ok, {
        path: rp, detail: ok ? "exactly one <h1>" : `${hs.length} <h1> elements`,
        ...(ok ? {} : {
          line: hs.length ? lineOf(html, hs[0].index) : 1,
          snippet: hs.length ? excerpt(html, hs[0].index, 1) : excerpt(html, 0, 2),
          expected: "exactly one <h1> per page (the page's main heading)",
          actual: `${hs.length} <h1> elements found`,
          hint: "keep one <h1>; demote the rest to <h2>",
        }),
      });
    }

    // 4. Images need alt (or deliberate decorative marking)
    {
      let bad = 0; let first = -1;
      for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = m[0];
        if (!/\salt=/.test(tag) && !/\srole="presentation"/.test(tag) && !/aria-hidden="true"/.test(tag)) {
          bad++;
          if (first < 0) first = m.index;
        }
      }
      const ok = bad === 0;
      check("a11y/img-alt", "required", ok, {
        path: rp, detail: ok ? "all <img> labelled" : `${bad} <img> without alt`,
        ...(ok ? {} : {
          line: lineOf(html, first),
          snippet: excerpt(html, first, 2),
          expected: "every informative <img> has a non-empty alt attribute",
          actual: `${bad} <img> tag(s) with no alt, role=presentation, or aria-hidden`,
          hint: 'add alt="..." describing the image, or role="presentation" if decorative',
        }),
      });
    }

    // 5. Form controls need labels
    {
      let bad = 0; let first = -1; let firstTag = "";
      for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
        const tag = m[0];
        const kind = m[1];
        if (/type="(hidden|submit|button|reset)"/i.test(tag)) continue;
        const idm = /\sid="([^"]+)"/.exec(tag);
        const labelled =
          /aria-label=/.test(tag) || /aria-labelledby=/.test(tag) ||
          (idm && fors.has(idm[1])) || insideLabel(m.index);
        if (!labelled) { bad++; if (first < 0) { first = m.index; firstTag = tag; } }
      }
      const ok = bad === 0;
      check("a11y/input-label", "required", ok, {
        path: rp, detail: ok ? "all form controls labelled" : `${bad} control(s) without label`,
        ...(ok ? {} : {
          line: lineOf(html, first),
          snippet: excerpt(html, first, 3),
          expected: "every input/select/textarea has a <label>, wrapping label, or aria-label",
          actual: `${bad} control(s) with no label association`,
          hint: "wrap the control in <label>, add for=/id= pairing, or add aria-label",
        }),
      });
    }

    // 6. Buttons need accessible names
    {
      let bad = 0; let first = -1;
      for (const m of html.matchAll(/<button\b([\s\S]*?)>([\s\S]*?)<\/button>/gi)) {
        const attrs = m[1]; const inner = m[2];
        const text = inner.replace(/<[^>]+>/g, "").trim();
        if (!text && !/aria-label=/.test(attrs) && !/aria-labelledby=/.test(attrs)) {
          bad++;
          if (first < 0) first = m.index;
        }
      }
      const ok = bad === 0;
      check("a11y/button-name", "required", ok, {
        path: rp, detail: ok ? "all <button> named" : `${bad} <button> without accessible name`,
        ...(ok ? {} : {
          line: lineOf(html, first),
          snippet: excerpt(html, first, 2),
          expected: "every <button> has visible text or an aria-label",
          actual: `${bad} <button>(s) with empty content and no aria-label`,
          hint: "add button text or aria-label; never rely on JS alone to label it",
        }),
      });
    }

    // 7. No positive tabindex (breaks natural tab order)
    {
      const m = /tabindex="[1-9][0-9]*"/.exec(html);
      const ok = !m;
      check("a11y/no-positive-tabindex", "required", ok, {
        path: rp, detail: ok ? "no positive tabindex" : `positive tabindex at ${m[0]}`,
        ...(ok ? {} : {
          line: lineOf(html, m.index),
          snippet: excerpt(html, m.index, 2),
          expected: "tab order follows DOM order (tabindex 0 or -1 only)",
          actual: m[0],
          hint: "remove the positive tabindex; reorder the DOM instead",
        }),
      });
    }

    // 8. No bare "click here" link text
    {
      let bad = 0; let first = -1;
      for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
        const t = m[1].replace(/<[^>]+>/g, "").trim().toLowerCase();
        if (["click here", "read more", "learn more", "more", "here", "cliquez ici", "lire la suite", "en savoir plus", "ici"].includes(t)) {
          bad++;
          if (first < 0) first = m.index;
        }
      }
      const ok = bad === 0;
      check("a11y/link-text", "required", ok, {
        path: rp, detail: ok ? "link text descriptive" : `${bad} bare link text(s)`,
        ...(ok ? {} : {
          line: lineOf(html, first),
          snippet: excerpt(html, first, 1),
          expected: "link text describes its destination out of context",
          actual: `${bad} link(s) with bare text like "click here"`,
          hint: 'rewrite as "Read the Mesh Console guide" instead of "click here"',
        }),
      });
    }

    // 9. <main> landmark (expected: app-like pages such as games may omit it)
    {
      const ok = /<main[\s>]/.test(html);
      check("a11y/main-landmark", "expected", ok, {
        path: rp, detail: ok ? "<main> present" : "no <main> landmark",
        ...(ok ? {} : {
          expected: "one <main> landmark wrapping the primary content",
          actual: "no <main> element",
          hint: "wrap the page's primary content in <main>",
        }),
      });
    }

    // 10. Heading levels do not skip (expected: legacy content may skip)
    {
      const levels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) => +m[1]);
      let badIdx = -1;
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i - 1] + 1) { badIdx = i; break; }
      }
      const ok = badIdx < 0;
      check("a11y/heading-order", "expected", ok, {
        path: rp, detail: ok ? "heading order clean" : `skipped level near heading #${badIdx + 1}`,
        ...(ok ? {} : {
          expected: "heading levels increase one step at a time (h2 then h3, not h2 then h4)",
          actual: `jump from h${levels[badIdx - 1]} to h${levels[badIdx]}`,
          hint: "fill in the missing level or demote the deeper heading",
        }),
      });
    }
  }
}

runChecks();
suite.run();
