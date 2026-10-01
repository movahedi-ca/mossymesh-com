#!/usr/bin/env node
/**
 * Structure smoke checks for mossymesh.com (Vite + vanilla TypeScript).
 * Ported from movahedi.ca's smoke.mjs; adapted for the Vite layout
 * (dist/ output, no Astro, no src/pages/, no bilingual, no CMS).
 *
 * Usage: node tests/smoke.mjs [--json]
 * Exit 0 if no required failures; exit 1 if required items missing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const asJson = process.argv.includes("--json");

/** @typedef {"required" | "expected" | "optional"} Severity */

/**
 * @typedef {object} Check
 * @property {string} id
 * @property {string} path
 * @property {Severity} severity
 * @property {string} [note]
 * @property {"file" | "dir" | "dir-nonempty"} [kind]
 * @property {number} [minFiles]
 */

/** @type {Check[]} */
const CHECKS = [
  // Core build config
  { id: "pkg", path: "package.json", severity: "required" },
  { id: "vite-config", path: "vite.config.ts", severity: "required" },
  { id: "tsconfig", path: "tsconfig.json", severity: "required" },

  // Entry points
  { id: "page-home", path: "index.html", severity: "required" },
  { id: "page-api", path: "api.html", severity: "required" },
  { id: "page-developers", path: "developers.html", severity: "required" },
  { id: "src-main", path: "src/main.ts", severity: "required" },
  { id: "src-api-page", path: "src/api-page.ts", severity: "required" },
  { id: "src-styles", path: "src/styles.css", severity: "required" },

  // Public (copied to dist/)
  { id: "favicon-svg", path: "public/favicon.svg", severity: "required" },
  { id: "robots", path: "public/robots.txt", severity: "required" },
  { id: "sitemap", path: "public/sitemap.xml", severity: "required" },
  { id: "headers", path: "public/_headers", severity: "expected", note: "security headers for Pages" },
  { id: "redirects", path: "public/_redirects", severity: "expected", note: "pretty-URL redirects" },
  { id: "openapi", path: "public/openapi.yaml", severity: "required" },
  { id: "llms-txt", path: "public/llms.txt", severity: "expected" },
  { id: "indexnow-key", path: "public/.well-known", severity: "expected", kind: "dir-nonempty", note: "IndexNow key file" },
  { id: "api-json", path: "public/api", severity: "expected", kind: "dir-nonempty", note: "static API JSON endpoints" },

  // Test infrastructure (this port)
  { id: "tests-dir", path: "tests", severity: "required", kind: "dir-nonempty" },
  { id: "diag-lib", path: "tests/lib/diag.mjs", severity: "required" },
  { id: "test-smoke", path: "tests/smoke.mjs", severity: "required" },
  { id: "test-a11y", path: "tests/a11y-static.mjs", severity: "required" },
  { id: "test-links", path: "tests/link-integrity.mjs", severity: "required" },
  { id: "test-content", path: "tests/content-quality.mjs", severity: "required" },
  { id: "test-perf", path: "tests/perf-budgets.mjs", severity: "required" },
  { id: "test-seo", path: "tests/seo-smoke.mjs", severity: "required" },
  { id: "lint-emdash", path: "scripts/lint-no-emdash.mjs", severity: "required" },
  { id: "ci-workflow", path: ".github/workflows/ci.yml", severity: "required" },
];

/**
 * @param {string} abs
 * @returns {number}
 */
function countFilesRecursive(abs) {
  if (!existsSync(abs)) return 0;
  let n = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else n += 1;
    }
  };
  walk(abs);
  return n;
}

/**
 * @param {Check} check
 */
function evaluate(check) {
  const abs = join(ROOT, check.path);
  const kind = check.kind ?? "file";
  let ok = false;
  let detail = "";

  if (kind === "file") {
    ok = existsSync(abs) && statSync(abs).isFile();
    detail = ok ? "present" : "MISSING file";
  } else if (kind === "dir") {
    ok = existsSync(abs) && statSync(abs).isDirectory();
    detail = ok ? "dir present" : "MISSING dir";
  } else if (kind === "dir-nonempty") {
    const exists = existsSync(abs) && statSync(abs).isDirectory();
    const count = exists ? countFilesRecursive(abs) : 0;
    const min = check.minFiles ?? 1;
    ok = exists && count >= min;
    detail = !exists
      ? "MISSING dir"
      : count >= min
        ? `${count} file(s)`
        : `EMPTY (0 files, need ≥${min})`;
  }

  return { ...check, ok, detail, abs };
}

/**
 * Extra integrity checks (not pure path existence).
 */
function integrityChecks() {
  /** @type {{ id: string, severity: Severity, ok: boolean, detail: string, note?: string }[]} */
  const results = [];

  // package.json scripts wired
  const pkgPath = join(ROOT, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    for (const script of [
      "build",
      "test:smoke",
      "test:a11y",
      "test:links",
      "test:seo",
      "test:perf",
      "test:content",
      "lint:style",
    ]) {
      const ok = !!pkg.scripts?.[script];
      results.push({
        id: `script-${script}`,
        severity: "required",
        ok,
        detail: ok ? `npm run ${script}` : `MISSING scripts.${script}`,
      });
    }
  }

  // Home page references the TS entry
  const indexPath = join(ROOT, "index.html");
  if (existsSync(indexPath)) {
    const idx = readFileSync(indexPath, "utf8");
    const ok = idx.includes('/src/main.ts');
    results.push({
      id: "home-loads-main-ts",
      severity: "required",
      ok,
      detail: ok ? "script src=/src/main.ts" : "home does not reference /src/main.ts",
    });
  }

  // Build output exists and has the three pages
  for (const page of ["index.html", "api.html", "developers.html"]) {
    const p = join(ROOT, "dist", page);
    const ok = existsSync(p) && statSync(p).isFile();
    results.push({
      id: `dist-${page}`,
      severity: "required",
      ok,
      detail: ok ? "built" : "MISSING from dist/ (run npm run build)",
    });
  }

  // dist assets bundle present (vite output)
  const assetsDir = join(ROOT, "dist", "assets");
  const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const hasJs = assets.some((f) => f.endsWith(".js"));
  const hasCss = assets.some((f) => f.endsWith(".css"));
  results.push({
    id: "dist-assets",
    severity: "required",
    ok: hasJs && hasCss,
    detail: hasJs && hasCss ? `${assets.length} asset file(s)` : "MISSING js/css bundles in dist/assets",
  });

  return results;
}

function main() {
  const pathResults = CHECKS.map(evaluate);
  const extra = integrityChecks();

  const all = [
    ...pathResults.map((r) => ({
      id: r.id,
      path: r.path,
      severity: r.severity,
      ok: r.ok,
      detail: r.detail,
      note: r.note,
    })),
    ...extra,
  ];

  const failedRequired = all.filter((r) => !r.ok && r.severity === "required");
  const failedExpected = all.filter((r) => !r.ok && r.severity === "expected");
  const failedOptional = all.filter((r) => !r.ok && r.severity === "optional");
  const passed = all.filter((r) => r.ok);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          root: ROOT,
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
    console.log(`mossymesh.com structure smoke – ${relative(process.cwd(), ROOT) || "."}\n`);

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
    printGroup("MISSING expected (gaps)", failedExpected, "!");
    printGroup("MISSING optional", failedOptional, "·");

    console.log("── Summary ──");
    console.log(
      `  ${passed.length} passed · ${failedRequired.length} required fail · ${failedExpected.length} expected missing · ${failedOptional.length} optional missing`,
    );
    if (failedRequired.length) {
      console.log("  Result: FAIL (required checks)");
    } else if (failedExpected.length) {
      console.log("  Result: PASS with gaps (expected files still missing)");
    } else {
      console.log("  Result: PASS");
    }
  }

  process.exit(failedRequired.length ? 1 : 0);
}

main();
