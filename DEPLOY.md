# Deploy mossymesh.com (Cloudflare Pages)

Official site for **MossyMesh** → **https://mossymesh.com**  
Repo: https://github.com/movahedi-ca/mossymesh-com

This guide covers production deploy, custom domain DNS, CORS headers for `/api/*`, and local CLI deploy.

---

## Architecture (what gets deployed)

| Piece | Source | Served as |
| --- | --- | --- |
| Marketing UI | Vite build → `dist/` | Static HTML/JS/CSS |
| Machine APIs | `public/api/**` → `dist/api/**` | Static JSON on CDN |
| OpenAPI | `public/openapi.yaml` (or similar) | Static file |
| CORS + security | `public/_headers` | Cloudflare Pages edge headers |
| Path rewrites | `public/_redirects` | `/api/v1/health` → `health.json` (200) |

No Node server in production. Cloudflare Pages serves the static `dist` output.

---

## Path A — Recommended: Cloudflare Pages + GitHub

Cloudflare builds and deploys on every push to `main`. No deploy secrets in GitHub required.

### 1. Push the repo (already done)

```text
https://github.com/movahedi-ca/mossymesh-com
```

Confirm `main` has the latest commit (including `wrangler.toml`, `public/_headers`, `public/_redirects`).

### 2. Create the Pages project

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) and select the account that should own the site.
2. Go to **Workers & Pages** (left nav).
3. Click **Create** → **Pages** → **Connect to Git**.
4. Authorize Cloudflare’s GitHub app if prompted.
5. Select repository **`movahedi-ca/mossymesh-com`**.
6. Click **Begin setup**.

### 3. Build settings (exact values)

| Setting | Value |
| --- | --- |
| Project name | `mossymesh-com` |
| Production branch | `main` |
| Framework preset | **None** (or Vite if listed) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (leave default) |

**Environment variables** (Build):

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `20` |

(Node 20+ is required. You can also set Node via `.nvmrc` if you add one later.)

Click **Save and Deploy**. Wait for the first build to finish.

Default preview URL looks like:

```text
https://mossymesh-com.pages.dev
```

### 4. Custom domains: mossymesh.com + www

1. In the Pages project → **Custom domains** → **Set up a custom domain**.
2. Add **`mossymesh.com`**.
3. Add **`www.mossymesh.com`**.
4. Follow Cloudflare’s prompts to attach the zone / create DNS records.

#### If the domain is already on Cloudflare (same account)

Cloudflare usually auto-creates:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` (or apex via CNAME flattening) | `mossymesh-com.pages.dev` | Proxied (orange cloud) |
| CNAME | `www` | `mossymesh-com.pages.dev` | Proxied (orange cloud) |

Exact UI labels may say “Add record” automatically — accept the recommended records and leave **Proxy status: Proxied**.

#### If the domain is registered elsewhere (not on Cloudflare DNS)

Either:

**Option B1 — Move DNS to Cloudflare (simplest long-term)**  
1. Add site `mossymesh.com` in Cloudflare → **Add a site**.  
2. Change nameservers at the registrar to the two Cloudflare nameservers shown.  
3. After active, attach the domain to the Pages project as above.

**Option B2 — Keep external DNS**  
At your DNS host, create what Pages shows (typically):

| Type | Host | Value | Notes |
| --- | --- | --- | --- |
| CNAME | `www` | `mossymesh-com.pages.dev` | Always works for www |
| CNAME or ALIAS/ANAME | `@` | `mossymesh-com.pages.dev` | Only if registrar supports apex CNAME/ALIAS |
| Or A/AAAA | `@` | IPs Cloudflare lists in the domain setup UI | Use only the IPs Cloudflare displays for this project |

Complete SSL/TLS validation if Cloudflare shows a pending certificate. Full (strict) is fine once the domain is proxied on Cloudflare.

### 5. SSL / HTTPS

- Pages issues free certificates for custom domains.
- Wait until status is **Active**.
- Prefer redirect HTTP → HTTPS (Cloudflare default for proxied hostnames).
- Optional: **Rules** → Redirect `www` → apex or apex → `www` (pick one canonical host).

### 6. Verify production

After DNS green and last deploy success:

```bash
# Project metadata API
curl -sS -D- "https://mossymesh.com/api/v1/project.json" -o -

# Bare path rewrite (should return same JSON body as .json)
curl -sS -D- "https://mossymesh.com/api/v1/project" -o -

# Health
curl -sS "https://mossymesh.com/api/v1/health.json"

# OpenAPI
curl -sS -D- "https://mossymesh.com/openapi.yaml" -o - | head

# CORS preflight smoke (expect ACAO: *)
curl -sS -D- -X OPTIONS "https://mossymesh.com/api/v1/project.json" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" -o NUL
```

Expect:

- HTTP **200**
- `access-control-allow-origin: *` on `/api/*`
- `content-type` appropriate for JSON/YAML
- Body matches repo `public/api/**` content

Also open in a browser:

- https://mossymesh.com/
- https://mossymesh.com/developers.html (or `/developers` if routed)
- https://mossymesh.com/api.html
- https://mossymesh.com/openapi.yaml

---

## Path B — CLI deploy (local or one-off)

Use when you want a manual publish without waiting for Git, or for testing.

### Prerequisites

1. Node.js **20+**
2. Cloudflare account with Pages enabled
3. Logged-in Wrangler:

```bash
npx wrangler login
```

Browser opens → authorize the Cloudflare account that owns the Pages project.

### Deploy

```bash
cd mossymesh-com
npm install
npm run build
npx wrangler pages deploy dist --project-name=mossymesh-com
```

Or one shot:

```bash
npm run deploy
```

(`package.json` script: `npm run build && wrangler pages deploy dist --project-name=mossymesh-com`)

First CLI deploy may ask you to create the project if it does not exist yet — confirm name **`mossymesh-com`**.

### Non-interactive CI token (optional)

If you skip Git integration and use GitHub Actions deploy:

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token**.
2. Use template **Edit Cloudflare Workers** (includes Pages) or a custom token with **Account → Cloudflare Pages → Edit**.
3. Copy **Account ID** from the right sidebar of any zone / Workers overview.
4. In GitHub repo → **Settings** → **Secrets and variables** → **Actions**:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. Run workflow **Build & optional Pages deploy** → **Run workflow** (`workflow_dispatch`).

The default `deploy` job only runs on **manual** dispatch when those secrets are present, so it does not fight automatic Git-based deploys.

---

## Headers & redirects (edge behavior)

Configured in-repo (copied into `dist` by Vite from `public/`):

### `public/_headers`

- **Global:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP.
- **`/api/*`:**  
  - `Access-Control-Allow-Origin: *`  
  - `Access-Control-Allow-Methods: GET, OPTIONS`  
  - `Access-Control-Allow-Headers: Content-Type, Accept`  
  - `Cache-Control: public, max-age=300`
- **`/openapi.yaml` / `/openapi.json`:** CORS allow + content type + short cache.

### `public/_redirects`

SPA-style **200 rewrites** (URL stays extensionless; file is `.json`):

```text
/api/v1/health    → /api/v1/health.json
/api/v1/project   → /api/v1/project.json
/api/v1/stack     → /api/v1/stack.json
/api/v1/phases    → /api/v1/phases.json
/api/v1/endpoints → /api/v1/endpoints.json
```

---

## wrangler.toml

```toml
name = "mossymesh-com"
compatibility_date = "2026-07-01"
pages_build_output_dir = "dist"
```

Keeps local `wrangler pages` commands aligned with the Pages project name and output dir.

---

## Local development (not production DNS)

```bash
npm install
npm run dev      # Vite dev server (typically http://localhost:5173)
npm run build    # writes dist/
npm run preview  # serve dist locally
```

`_headers` / `_redirects` are enforced by **Cloudflare Pages**, not by Vite. Use a production deploy or `wrangler pages dev dist` to validate edge headers:

```bash
npm run build
npx wrangler pages dev dist
```

---

## Rollback

- **Git integration:** Pages → **Deployments** → open a previous successful deployment → **Retry deployment** / **Rollback to this deployment**.
- **CLI:** Redeploy an older commit: `git checkout <sha> && npm run deploy` (then return to `main`).

---

## Checklist (operator)

- [ ] GitHub repo `movahedi-ca/mossymesh-com` is up to date on `main`
- [ ] Cloudflare Pages project **mossymesh-com** connected to that repo
- [ ] Build: `npm run build`, output `dist`, Node 20+
- [ ] Custom domains `mossymesh.com` and `www.mossymesh.com` **Active**
- [ ] DNS proxied (orange cloud) if using Cloudflare DNS
- [ ] `curl https://mossymesh.com/api/v1/project.json` → 200 + JSON
- [ ] `curl -I https://mossymesh.com/api/v1/health.json` shows `access-control-allow-origin: *`
- [ ] OpenAPI URL loads in browser and CLI
- [ ] Canonical host redirect decided (www ↔ apex)

---

## What this agent cannot do for you

Cloudflare login, GitHub OAuth for the CF Git app, registrar nameserver changes, and production DNS edits require **your** account access. Follow the clicks above; no force-push or account secrets are stored in this repo.
