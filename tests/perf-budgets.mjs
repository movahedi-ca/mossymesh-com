#!/usr/bin/env node
/**
 * Performance-budget checks against the production build (dist/).
 *
 * Usage: node tests/perf-budgets.mjs [--json] [--dist path/to/dist]
 *
 * Two honest budgets, no vanity metrics:
 *  - page weight under 1 MB (required): a static page has no business
 *    exceeding this; catches accidental asset inlining.
 *  - images carry width+height (expected): prevents cumulative layout
 *    shift, the Core Web Vital static HTML can actually control.
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

/** Hard ceiling: a static HTML page exceeding this is a regression. */
const PAGE_WEIGHT_LIMIT = 1024 * 1024;

const suite = createSuite({ name: "performance budgets", distDir: DIST });
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

function runChecks() {
  if (!existsSync(DIST)) {
    check("perf/dist-exists", "required", false, {
      detail: `dist/ not found at ${DIST}`,
      expected: "npm run build produces dist/ before QA suites run",
      actual: "dist/ missing",
      hint: "run npm run build first",
    });
    return;
  }

  for (const page of htmlPages(DIST)) {
    const html = readFileSync(page, "utf8");
    const rp = rel(page);
    const bytes = Buffer.byteLength(html, "utf8");

    // 1. Page weight ceiling
    {
      const ok = bytes <= PAGE_WEIGHT_LIMIT;
      check("perf/page-weight", "required", ok, {
        path: rp,
        detail: ok ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024).toFixed(0)} KB exceeds 1 MB`,
        ...(ok ? {} : {
          expected: `HTML under ${(PAGE_WEIGHT_LIMIT / 1024).toFixed(0)} KB`,
          actual: `${(bytes / 1024).toFixed(0)} KB`,
          hint: "move large inline datasets to fetched JSON; check for accidentally inlined assets",
        }),
      });
    }

    // 2. Images declare dimensions (CLS)
    {
      let bad = 0; let first = -1;
      for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        if (!/\swidth=/.test(m[0]) || !/\sheight=/.test(m[0])) {
          bad++;
          if (first < 0) first = m.index;
        }
      }
      const ok = bad === 0;
      check("perf/img-dimensions", "expected", ok, {
        path: rp,
        detail: ok ? "all <img> sized" : `${bad} <img> without width+height`,
        ...(ok ? {} : {
          line: lineOf(html, first),
          snippet: excerpt(html, first, 1),
          expected: "every <img> declares width and height (reserves layout space)",
          actual: `${bad} <img> tag(s) missing dimensions`,
          hint: "add width/height attributes matching the intrinsic aspect ratio",
        }),
      });
    }
  }
}

runChecks();
suite.run();
