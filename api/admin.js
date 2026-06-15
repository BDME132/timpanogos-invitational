// Server-side admin API for the Timpanogos Invitational site.
//
// One password (ADMIN_PASSWORD) gates everything. On login we set a signed,
// HttpOnly session cookie. Reads and writes go through the GitHub API using a
// server-held token (GITHUB_TOKEN) that NEVER reaches the browser. Saving commits
// to the repo, which triggers a Vercel rebuild.
//
// Env vars (Vercel → Settings → Environment Variables):
//   ADMIN_PASSWORD  the shared coach password
//   GITHUB_TOKEN    PAT with Contents: Read/write on this repo
//
// Actions (via ?action=…):
//   GET  session                 -> { authed }
//   POST login    { password }   -> sets cookie
//   POST logout                  -> clears cookie
//   GET  get      ?path=…        -> { content, sha }      (auth)
//   GET  listNews                -> [ { name, path, sha } ] (auth)
//   POST save     { path, content, message, sha? }        (auth)
//   POST delete   { path, sha, message }                  (auth)

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const REPO = 'BDME132/timpanogos-invitational';
const BRANCH = 'main';
const GH = 'https://api.github.com';
const COOKIE = 'admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ── session helpers ──
function signingKey() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}
function sign(payloadB64) {
  return createHmac('sha256', signingKey()).update(payloadB64).digest('base64url');
}
function makeSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function verifySession(value) {
  if (!value || !value.includes('.')) return false;
  const [payload, sig] = value.split('.');
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}
function passwordMatches(submitted) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (typeof submitted !== 'string' || expected === '') return false;
  const a = createHash('sha256').update(submitted).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function getCookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}
function setSessionCookie(res, value, maxAgeSec) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`);
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

// ── path allowlist (prevents writing arbitrary repo files) ──
function allowedPath(p) {
  return /^src\/data\/(meet|schedule|records|champions|alumni|results-archive)\.json$/.test(p)
    || /^src\/content\/news\/[a-z0-9][a-z0-9-]*\.md$/.test(p);
}

// ── GitHub helpers (server-side token only) ──
function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'timpinvite-admin',
  };
}
async function ghGetFile(path) {
  const r = await fetch(`${GH}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: ghHeaders() });
  if (r.status === 404) return { status: 404, content: '', sha: null };
  const j = await r.json();
  return { status: r.status, content: j.content ? Buffer.from(j.content, 'base64').toString('utf8') : '', sha: j.sha || null };
}
async function ghList(dir) {
  const r = await fetch(`${GH}/repos/${REPO}/contents/${dir}?ref=${BRANCH}`, { headers: ghHeaders() });
  const j = await r.json();
  return Array.isArray(j) ? j.filter((f) => f.type === 'file').map((f) => ({ name: f.name, path: f.path, sha: f.sha })) : [];
}
async function ghPut(path, contentStr, message, sha) {
  const body = { message, content: Buffer.from(contentStr, 'utf8').toString('base64'), branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH}/repos/${REPO}/contents/${path}`, {
    method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, sha: j.content?.sha, error: j.message };
}
async function ghDelete(path, sha, message) {
  const r = await fetch(`${GH}/repos/${REPO}/contents/${path}`, {
    method: 'DELETE', headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, error: j.message };
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
    return sendJson(res, 500, { error: 'Server not configured (ADMIN_PASSWORD / GITHUB_TOKEN missing).' });
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const action = url.searchParams.get('action') || '';
  const authed = verifySession(getCookie(req, COOKIE));

  // Reject cross-origin mutations.
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== req.headers.host) return sendJson(res, 403, { error: 'Bad origin' }); }
      catch { return sendJson(res, 403, { error: 'Bad origin' }); }
    }
  }

  // ── public actions ──
  if (action === 'session' && req.method === 'GET') {
    return sendJson(res, 200, { authed });
  }
  if (action === 'login' && req.method === 'POST') {
    const { password } = await readJson(req);
    if (passwordMatches(password)) {
      setSessionCookie(res, makeSession(), SESSION_TTL_MS / 1000);
      return sendJson(res, 200, { ok: true });
    }
    await new Promise((r) => setTimeout(r, 600));
    return sendJson(res, 401, { ok: false, error: 'Incorrect password.' });
  }
  if (action === 'logout' && req.method === 'POST') {
    setSessionCookie(res, '', 0);
    return sendJson(res, 200, { ok: true });
  }

  // ── everything below requires a valid session ──
  if (!authed) return sendJson(res, 401, { error: 'Not signed in.' });

  if (action === 'get' && req.method === 'GET') {
    const path = url.searchParams.get('path') || '';
    if (!allowedPath(path)) return sendJson(res, 400, { error: 'Path not allowed.' });
    const file = await ghGetFile(path);
    return sendJson(res, 200, { content: file.content, sha: file.sha });
  }
  if (action === 'listNews' && req.method === 'GET') {
    const files = (await ghList('src/content/news')).filter((f) => f.name.endsWith('.md'));
    return sendJson(res, 200, { files });
  }
  if (action === 'save' && req.method === 'POST') {
    const { path, content, message, sha } = await readJson(req);
    if (!allowedPath(path)) return sendJson(res, 400, { error: 'Path not allowed.' });
    if (typeof content !== 'string') return sendJson(res, 400, { error: 'Missing content.' });
    const out = await ghPut(path, content, message || `Update ${path} via admin`, sha);
    if (out.status >= 400) return sendJson(res, out.status, { error: out.error || 'Save failed.' });
    return sendJson(res, 200, { ok: true, sha: out.sha });
  }
  if (action === 'delete' && req.method === 'POST') {
    const { path, sha, message } = await readJson(req);
    if (!allowedPath(path) || !sha) return sendJson(res, 400, { error: 'Path/sha required.' });
    const out = await ghDelete(path, sha, message || `Delete ${path} via admin`);
    if (out.status >= 400) return sendJson(res, out.status, { error: out.error || 'Delete failed.' });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Unknown action.' });
}
