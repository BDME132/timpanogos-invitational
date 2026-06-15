# Timpanogos Invitational website

A mostly-static [Astro](https://astro.build/) site for the Timpanogos Invitational cross country
meet. It builds to plain HTML and deploys to **Vercel**, with one small serverless function that
powers the password-protected admin.

- **Live site:** https://timpanogos-invitational.vercel.app/
- **Admin (content editor):** https://timpanogos-invitational.vercel.app/admin/
- **Repo:** `BDME132/timpanogos-invitational`

There is **no database**. Content edits are made through the admin page (or by editing the data
files directly) and committed to the repo, which triggers an automatic Vercel rebuild. The only
server-side code is `api/oauth.js`, which checks the admin password.

> **Editing the site day-to-day?** You don't need anything in this file. See **[EDITING.md](./EDITING.md)**
> for the simple, click-by-click guide.

---

## How it works

| Piece | Where | Notes |
|-------|-------|-------|
| Public page | `src/pages/index.astro` | One landing page, rendered from the data files below |
| Editable content | `src/data/*.json` | meet details, schedule, records, champions, alumni, results archive |
| News posts | `src/content/news/*.md` | one markdown file per post |
| Admin UI | `public/admin/` | [Sveltia CMS](https://github.com/sveltia/sveltia-cms) — a form editor that commits to this repo |
| Admin login | `api/oauth.js` | serverless function: checks the shared password, hands the CMS a server-held GitHub token |
| Deploy | Vercel | builds and publishes on every push to `main` |

The admin is a browser-based CMS. The editor signs in **with the shared admin password**, edits
content through forms, and clicking *Publish* commits the change. Vercel then rebuilds and the site
updates in about a minute.

---

## One-time setup (required before the admin login works)

The admin login is gated by a single shared password, checked by a small serverless function
(`api/oauth.js`) on Vercel. Setup is two environment variables — only the repo owner needs to do
this, and it's a ~5-minute, one-time step.

### 1. Create a GitHub token for the server to commit with

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
   (https://github.com/settings/tokens?type=beta) → **Generate new token**.
2. Set:
   - **Repository access:** Only select repositories → `BDME132/timpanogos-invitational`
   - **Permissions:** Repository permissions → **Contents: Read and write**
3. Generate it and copy the token (`github_pat_…`). GitHub shows it only once.

### 2. Add the secrets to Vercel

In the Vercel project: **Settings → Environment Variables**, add (see `.env.example`):

| Name | Value |
|------|-------|
| `ADMIN_PASSWORD` | the password you want coaches to type at `/admin` |
| `GITHUB_TOKEN`   | the fine-grained token from step 1 |

Redeploy (or push a commit) so the function picks them up. Also confirm the Vercel project is
**connected to this GitHub repo**, so CMS edits (which are commits) trigger an auto-rebuild.

### 3. Give an editor access

Just give them the **admin password and the admin URL** — no GitHub account, no invites. To revoke
access for everyone at once, change `ADMIN_PASSWORD` (and rotate `GITHUB_TOKEN`) and redeploy.

---

## Local development

Requires [pnpm](https://pnpm.io/) and Node 22+.

```bash
pnpm install      # install dependencies
pnpm dev          # start a local dev server (http://localhost:4321)
pnpm build        # produce a production build in dist/
pnpm preview      # serve the production build locally
```

The admin login talks to the serverless function, so it only works where that function runs: the
deployed site, or locally via `vercel dev` with `ADMIN_PASSWORD` and `GITHUB_TOKEN` set in a local
`.env` (see `.env.example`). During plain `pnpm dev` you can still edit the JSON/markdown files
directly.

## Assets to add

- `public/logo.jpg` — used by the nav, hero, and favicon. **Currently missing** — drop the logo
  image here. Until it's added, those spots show a broken-image icon.
- The course map is a styled placeholder in `src/pages/index.astro`; swap in an image when ready.
