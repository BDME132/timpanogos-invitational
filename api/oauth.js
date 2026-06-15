// Custom OAuth endpoint for Sveltia CMS.
//
// Instead of sending coaches through GitHub login, this gates the admin behind a
// single shared password (ADMIN_PASSWORD) and, on success, hands the CMS a
// server-held GitHub token (GITHUB_TOKEN) using the same postMessage handshake the
// reference `sveltia-cms-auth` client uses. The CMS then commits with that token, so
// no coach needs a GitHub account.
//
// Required Vercel environment variables:
//   ADMIN_PASSWORD  the shared coach password
//   GITHUB_TOKEN    a fine-grained PAT scoped to this repo only, Contents: Read/write
//
// Sveltia config (public/admin/config.yml) points here via:
//   base_url: https://<site>
//   auth_endpoint: api/oauth

import { createHash, timingSafeEqual } from 'node:crypto';

const PROVIDER = 'github';

/** Constant-time password check that doesn't leak length. */
function passwordMatches(submitted, expected) {
  if (typeof submitted !== 'string' || typeof expected !== 'string' || expected === '') {
    return false;
  }
  // Hash both to a fixed 32-byte length so timingSafeEqual never sees mismatched sizes.
  const a = createHash('sha256').update(submitted).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Read a urlencoded form body regardless of how Vercel parsed it. */
async function readForm(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function loginPage({ error = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Coach sign in — Timpanogos Invitational</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
           display: grid; place-items: center; min-height: 100vh; margin: 0; background: #0f2417; }
    form { background: #fff; color: #11261a; padding: 2rem; border-radius: 12px; width: min(92vw, 340px);
           box-shadow: 0 12px 40px rgba(0,0,0,.35); }
    h1 { font-size: 1.15rem; margin: 0 0 .25rem; }
    p  { margin: 0 0 1.25rem; color: #4a5a50; font-size: .9rem; }
    label { display: block; font-weight: 600; font-size: .85rem; margin-bottom: .35rem; }
    input { width: 100%; box-sizing: border-box; padding: .6rem .7rem; font-size: 1rem;
            border: 1px solid #c6d2cb; border-radius: 8px; }
    button { width: 100%; margin-top: 1rem; padding: .65rem; font-size: 1rem; font-weight: 600;
             color: #fff; background: #1f6f43; border: 0; border-radius: 8px; cursor: pointer; }
    button:hover { background: #195c38; }
    .error { color: #b00020; font-size: .85rem; margin: .25rem 0 0; min-height: 1.1em; }
  </style>
</head>
<body>
  <form method="POST" autocomplete="off">
    <h1>Coach sign in</h1>
    <p>Enter the meet admin password to edit the site.</p>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autofocus required />
    <p class="error">${escapeHtml(error)}</p>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}

function successPage(token) {
  // Mirrors the sveltia-cms-auth handshake: announce, then return the token only to the
  // verified opener origin (the CMS), never to '*'.
  const payload = JSON.stringify({ provider: PROVIDER, token });
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="robots" content="noindex" /><title>Signing in…</title></head>
<body>
  <p>Signing in…</p>
  <script>
    (function () {
      var payload = ${JSON.stringify(payload)};
      function receive(e) {
        if (e.data !== 'authorizing:${PROVIDER}') return;
        // Hand the token back only to our own origin (the CMS window).
        if (e.origin !== window.location.origin) return;
        window.removeEventListener('message', receive, false);
        window.opener.postMessage('authorization:${PROVIDER}:success:' + payload, e.origin);
        window.close();
      }
      window.addEventListener('message', receive, false);
      // Kick off the handshake.
      window.opener && window.opener.postMessage('authorizing:${PROVIDER}', '*');
    })();
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const githubToken = process.env.GITHUB_TOKEN;

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  if (!adminPassword || !githubToken) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(loginPage({ error: 'Server is not configured (missing ADMIN_PASSWORD or GITHUB_TOKEN).' }));
    return;
  }

  // TEMPORARY diagnostic: GET /api/oauth?diag=1 reports whether the server-held
  // token can reach the repo, without ever exposing the token itself. Remove once
  // the admin login is confirmed working.
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.searchParams.get('diag') === '1') {
    let repoStatus = 0;
    let message = '';
    try {
      const r = await fetch('https://api.github.com/repos/BDME132/timpanogos-invitational', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'timpinvite-admin',
        },
      });
      repoStatus = r.status;
      const body = await r.json().catch(() => ({}));
      message = body.message || body.full_name || '';
    } catch (e) {
      message = `fetch failed: ${e.message}`;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      tokenType: githubToken.startsWith('github_pat_') ? 'fine-grained'
        : githubToken.startsWith('ghp_') ? 'classic'
        : githubToken.startsWith('ghs_') ? 'app-installation'
        : 'unknown',
      tokenLength: githubToken.length,
      repoStatus,
      message,
    }, null, 2));
    return;
  }

  if (req.method === 'POST') {
    const form = await readForm(req);
    if (passwordMatches(form.password, adminPassword)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(successPage(githubToken));
      return;
    }
    // Small fixed delay to blunt brute-force attempts.
    await new Promise((r) => setTimeout(r, 600));
    res.statusCode = 401;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(loginPage({ error: 'Incorrect password. Try again.' }));
    return;
  }

  // GET (and anything else): show the password form. No token is ever in this page.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(loginPage());
}
