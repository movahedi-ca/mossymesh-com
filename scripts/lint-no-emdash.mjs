#!/usr/bin/env node
/**
 * lint-no-emdash.mjs – house style gate: no em dashes ship on mossymesh.com.
 *
 * Mohammad's standing writing rule bans em dashes (U+2014) and anything that
 * renders as one (&amp;mdash; / &amp;#8212;) in all site-facing copy. Em dashes kept
 * creeping back in via new articles, tools, and data files, so this lint is
 * the permanent fix. It runs in two places:
 *
 *   1. `npm run lint:style`          – any session, before `npm run build`
 *   2. .github/workflows/ci.yml     – CI on every push / pull request
 *
 * There is intentionally NO allowlist and NO --skip flag: a violation means
 * the deploy does not happen. If a genuinely functional use ever needs a
 * literal em dash, rewrite it to avoid the literal (e.g. "\u2014" escapes,
 * String.fromCharCode(8212), or "&"+"mdash;") instead of carving an exception.
 *
 * Usage:
 *   node scripts/lint-no-emdash.mjs            # scan repo source
 *   node scripts/lint-no-emdash.mjs --dist     # scan built dist html files
 *
 * Exit 0 when clean, 1 with a file:line list when violations are found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."));
const EM_DASH = "\u2014"; // escape: no literal in this file
const ENTITY_RE = /&(mdash|#8212|#x2014);/i;
// In site-feeding dirs (src/, public/) the backslash-u-2014 escape is also
// banned: it becomes a literal em dash at runtime/build. Tooling under
// scripts//tests may use the escape functionally (sanitizers, detectors).
const ESCAPE_RE = /\\u2014/i;
const SITE_FEED_DIRS = ["src/", "public/"];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".astro",
  ".wrangler",
  ".vercel",
  "Images",
]);
const SKIP_FILES = new Set(["package-lock.json"]);
const SKIP_EXT = new Set([".map", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".woff", ".woff2", ".ttf", ".eot", ".zip"]);

function isTextFile(path) {
  try {
    const buf = readFileSync(path);
    if (buf.includes(0)) return false; // binary
    return true;
  } catch {
    return false;
  }
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(full);
    } else if (e.isFile()) {
      if (SKIP_FILES.has(e.name)) continue;
      if ([...SKIP_EXT].some((ext) => e.name.endsWith(ext))) continue;
      yield full;
    }
  }
}

function lintFile(path) {
  const hits = [];
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return hits;
  }
  const rel = relative(ROOT, path).split(sep).join("/");
  const siteFed = SITE_FEED_DIRS.some((d) => rel === d.slice(0, -1) || rel.startsWith(d));
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(EM_DASH) || ENTITY_RE.test(line) ||
        (siteFed && ESCAPE_RE.test(line))) {
      hits.push({ path, line: i + 1, text: line.trim().slice(0, 140) });
    }
  }
  return hits;
}

function main() {
  const distMode = process.argv.includes("--dist");
  const roots = distMode ? [join(ROOT, "dist")] : [ROOT];
  try {
    for (const r of roots) statSync(r);
  } catch {
    console.error(`lint-no-emdash: ${distMode ? "dist/" : "repo root"} not found, nothing to scan`);
    process.exit(2);
  }

  const violations = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (!distMode && !isTextFile(file)) continue;
      if (distMode && !file.endsWith(".html")) continue;
      violations.push(...lintFile(file));
    }
  }

  if (violations.length === 0) {
    console.log(`lint-no-emdash: clean (${distMode ? "dist html" : "repo source"})`);
    process.exit(0);
  }

  console.error(`lint-no-emdash: ${violations.length} violation(s) – em dashes do not ship:`);
  const byFile = new Map();
  for (const v of violations) {
    const rel = relative(ROOT, v.path).split(sep).join("/");
    if (!byFile.has(rel)) byFile.set(rel, []);
    byFile.get(rel).push(v);
  }
  for (const [rel, vs] of [...byFile.entries()].sort()) {
    for (const v of vs.slice(0, 5)) console.error(`  ${rel}:${v.line}: ${v.text}`);
    if (vs.length > 5) console.error(`  ${rel}: ... and ${vs.length - 5} more`);
  }
  console.error("\nFix: replace the em dash with an en dash, or rewrite functional uses without the literal.");
  process.exit(1);
}

main();
