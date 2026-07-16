# Deploy mossymesh.com (Cloudflare Pages)

Official site for **MossyMesh** → **https://mossymesh.com**  
Repo: https://github.com/movahedi-ca/mossymesh-com

This guide covers production deploy, custom domain DNS, CORS headers for `/api/*`, and local CLI deploy.

---

## STOP — if you see this in Cloudflare build logs

```text
/opt/buildhome/.config/.wrangler/logs/...
Authentication error [code: 10000]
Failed: error occurred while running deploy command
CLOUDFLARE_API_TOKEN environment variable
Super Administrator - All Privileges
```

### What it means

| Fact | Meaning |
| --- | --- |
| Path `/opt/buildhome/` | This is **Cloudflare’s build VM**, not your PC |
| `CLOUDFLARE_API_TOKEN` | Wrangler is using an **API token**, not your Super Admin browser session |
| Super Administrator | Your **user role** is fine — the **token** still may lack Pages write |
| `running deploy command` | Project settings are running **Wrangler deploy** after the build (wrong for Git Pages) |

**Being Super Admin does not fix a bad/missing token permission.** Tokens are separate from membership roles.

### Fix (Cloudflare Dashboard) — do this first

Open: **Workers & Pages** → **mossymesh-com** → **Settings** → **Builds & deployments**

| Setting | Must be |
| --- | --- |
| **Framework preset** | **None** |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (empty / default) |
| **Deploy command** | **LEAVE EMPTY** — delete `npm run deploy`, `npx wrangler …`, etc. |
| **Non-production branch deploy command** | **LEAVE EMPTY** |

Cloudflare Pages Git integration **already uploads `dist` for you**. Running Wrangler inside the build is a second deploy and needs a special token — that is what fails with **10000**.

### Also remove these env vars from the Pages project (if set)

**Settings → Environment variables** (Production + Preview):

- Delete `CLOUDFLARE_API_TOKEN` if present  
- Delete `CLOUDFLARE_ACCOUNT_ID` if you only added them for Wrangler  

(You do **not** need them for a normal static Pages Git deploy.)

### After changing settings

1. **Save**
2. **Deployments** → **Retry deployment** (or push a commit to `main`)
3. Build log should end after `vite build` / uploading assets — **no** Wrangler “Authentication error”

### Already live (direct upload)

A successful CLI deploy is already at:

- https://mossymesh-com.pages.dev  
- Preview example: https://c3237eb2.mossymesh-com.pages.dev  

Attach **mossymesh.com** under **Custom domains** once Git builds are green (or keep using the direct-upload deployment).

### Optional: local deploy without tokens

```powershell
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
npx wrangler login
npm run deploy:local
```

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
| Build command | `npm run build` **only** (never `npm run deploy` / never `wrangler`) |
| Deploy command | **Empty** |
| Build output directory | `dist` |
| Root directory | `/` (leave default) |
| Framework preset | **None** (not Next.js / not Workers-only) |

**Environment variables** (Build):

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `20` |

Do **not** set `CLOUDFLARE_API_TOKEN` on the Pages project for Git builds.

**Common Cloudflare build failures**

| Error / symptom | Fix |
| --- | --- |
| `Failed: error occurred while running deploy command` + code **10000** | Clear **Deploy command**; remove API token env vars (see STOP section above) |
| GitHub Action fails instantly, 0 jobs | Do not put `secrets.*` in workflow `if:` — fixed in `.github/workflows/deploy.yml` |
| `npm ci` fails | Ensure `package-lock.json` is committed (it is) |
| Wrong output directory | Must be `dist`, not `build` or `.` |
| Functions + rewrite clash on `/api/v1/health` | Health is a Pages Function; other `/api/v1/*` use `_redirects` |

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
# Ensure a bad CI token is not shadowing OAuth:
#   unset CLOUDFLARE_API_TOKEN   (bash)
#   Remove-Item Env:CLOUDFLARE_API_TOKEN  (PowerShell)
npm run deploy:local
```

(`deploy:local` = `npm run build && wrangler pages deploy dist --project-name=mossymesh-com`)

First CLI deploy may ask you to create the project if it does not exist yet — confirm name **`mossymesh-com`**.

### Non-interactive CI token (optional)

If you skip Git integration and use GitHub Actions deploy:

1. Cloudflare Dashboard → [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**.
2. Prefer **Create Custom Token** with **all** of:
   - **Account → Cloudflare Pages → Edit**
   - **Account → Account Settings → Read** (so Wrangler can resolve the account)
   - Include this account: **M.h.movahedi97@gmail.com's Account** (`59d2638c7628f0f7eaeb5875b610ea9e`)
3. Do **not** use a read-only / Global API Key stand-in. User API tokens that only have partial Workers scopes often fail Pages with **code 10000**.
4. Copy **Account ID** `59d2638c7628f0f7eaeb5875b610ea9e`.
5. In GitHub repo → **Settings** → **Secrets and variables** → **Actions**:
   - `CLOUDFLARE_API_TOKEN` = the new token
   - `CLOUDFLARE_ACCOUNT_ID` = `59d2638c7628f0f7eaeb5875b610ea9e`
6. Run workflow **Build & optional Pages deploy** → **Run workflow** (`workflow_dispatch`).

The default `deploy` job only runs on **manual** dispatch so it does not fight automatic Git-based deploys.

### Auth error 10000 (your token can whoami but Pages fails)

```text
Authentication error [code: 10000]
It looks like you are authenticating Wrangler via a custom API token
set in an environment variable.
```

**Cause:** `CLOUDFLARE_API_TOKEN` is set, but that token **cannot edit Pages** (wrong permissions, wrong account, or expired). Wrangler prefers the env token over OAuth, so even a good `wrangler login` is ignored.

**Fix (pick one):**

| Approach | Steps |
| --- | --- |
| **A. Use OAuth (simplest locally)** | Unset the bad token, then deploy: `Remove-Item Env:CLOUDFLARE_API_TOKEN` (PowerShell) or `unset CLOUDFLARE_API_TOKEN` (bash). Run `npx wrangler login` if needed. Then `npm run deploy`. |
| **B. New API token** | Create token with **Account → Cloudflare Pages → Edit** (see above). Replace GitHub secret / shell env with the new value. |
| **C. Git integration** | Cloudflare Dashboard → Pages → Connect Git → `movahedi-ca/mossymesh-com` — no API token needed for deploys. |

**PowerShell one-shot (OAuth path):**

```powershell
cd C:\Users\mhmov\mossymesh-com
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
npm run build
npx wrangler pages deploy dist --project-name=mossymesh-com
```

Project lives under account `59d2638c7628f0f7eaeb5875b610ea9e`. Live default host:

```text
https://mossymesh-com.pages.dev
```


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
