# Timpanogos Invitational website

A static [Astro](https://astro.build/) site for the Timpanogos Invitational cross country meet.
It builds to plain HTML and deploys automatically to **GitHub Pages**.

- **Live site:** https://timpanogos-invitational.vercel.app/ (update once you know the real URL)
- **Admin (content editor):** https://timpanogos-invitational.vercel.app/admin/
- **Repo:** `BDME132/timpanogos-invitational`

There is **no server and no database** — and nothing to pay for. Every deploy is a free GitHub
Pages build. Content edits are made through the admin page (or by editing the data files directly)
and committed to the repo, which triggers an automatic rebuild.

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
| Deploy | `.github/workflows/deploy.yml` | builds on every push to `main`, publishes to GitHub Pages |

The admin is a browser-only CMS: the editor signs in **with GitHub**, edits content through forms,
and clicking *Publish* commits the change. GitHub Actions then rebuilds and the site updates in
about a minute.

---

## One-time setup (required before the admin login works)

The admin page is built, but logging in needs a GitHub OAuth App. This is a ~5-minute, one-time
step that only the repo owner can do (it can't be scripted).

### 1. Create the GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
   (https://github.com/settings/developers).
2. Fill in:
   - **Application name:** `Timpanogos Invitational CMS`
   - **Homepage URL:** `https://timpanogos-invitational.vercel.app/`  ← use your real Vercel URL
   - **Authorization callback URL:** `https://timpanogos-invitational.vercel.app/admin/`  ← same
3. Click **Register application**.
4. Copy the **Client ID** shown on the next screen. (You do **not** need a client secret —
   Sveltia uses the secret-less PKCE flow.)

### 2. Add the Client ID to the site

In `public/admin/config.yml`, replace the placeholder:

```yaml
backend:
  name: github
  repo: BDME132/timpanogos-invitational
  branch: main
  auth_type: pkce
  app_id: PASTE_YOUR_CLIENT_ID_HERE   # <-- replace REPLACE_WITH_GITHUB_OAUTH_APP_CLIENT_ID
```

Commit and push. The admin login will work once GitHub Pages rebuilds.

### 3. Give the editor access

The editor signs in with GitHub, so they need:

- A free GitHub account (https://github.com/join).
- To be added as a **collaborator** on the repo:
  **GitHub → repo → Settings → Collaborators → Add people**, then they accept the email invite.

That's it — from then on they just use the admin page.

---

## Local development

Requires [pnpm](https://pnpm.io/) and Node 22+.

```bash
pnpm install      # install dependencies
pnpm dev          # start a local dev server (http://localhost:4321)
pnpm build        # produce a production build in dist/
pnpm preview      # serve the production build locally
```

The admin page's GitHub login only works on the deployed site (the OAuth callback URL points
there), but you can edit the JSON/markdown files directly during local development.

## Assets to add

- `public/logo.jpg` — used by the nav, hero, and favicon. **Currently missing** — drop the logo
  image here. Until it's added, those spots show a broken-image icon.
- The course map is a styled placeholder in `src/pages/index.astro`; swap in an image when ready.
