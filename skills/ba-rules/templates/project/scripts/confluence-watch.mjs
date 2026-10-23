#!/usr/bin/env node
// BA workflow kit — confluence-watch (kit design §6). Node >= 20, no dependencies, no AI, no MCP.
// Run by .github/workflows/confluence-watch.yml. Compares the source page (and children, attachments)
// in Confluence with ba-project.yaml; on a difference opens one issue "run /ba-sync" or comments on the
// open one. Never writes to the repository or to Confluence. Secrets are read from env only, never printed.

import { readFileSync, appendFileSync } from 'node:fs';

const env = process.env;
const summary = (line) => { console.log(line); if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, line + '\n'); };
const cfg = JSON.parse(readFileSync(env.BA_PROJECT_JSON, 'utf8'));
const { site, cloud_id: cloudId } = cfg.atlassian ?? {};
const src = cfg.source ?? {};
const watch = cfg.watch ?? {};
const label = watch.issue_label || 'ba-sync';
const errorLabel = 'ba-watch-error';

if (!watch.enabled) { summary('watch.enabled is false in ba-project.yaml — nothing checked.'); process.exit(0); }
if (!env.CONFLUENCE_EMAIL || !env.CONFLUENCE_API_TOKEN) {
  summary('Secrets CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN are not set — the BA adds them with `gh secret set`.');
  process.exit(1);
}

// Scoped API tokens go through the API gateway (needs cloud_id); a classic token can use the site URL.
const base = env.CONFLUENCE_API === 'site' ? `https://${site}/wiki` : `https://api.atlassian.com/ex/confluence/${cloudId}/wiki`;
const auth = 'Basic ' + Buffer.from(`${env.CONFLUENCE_EMAIL}:${env.CONFLUENCE_API_TOKEN}`).toString('base64');

class HttpError extends Error { constructor(status, what) { super(`${what}: HTTP ${status}`); this.status = status; } }
async function confluence(path, what) {
  const res = await fetch(base + path, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!res.ok) throw new HttpError(res.status, what);
  return res.json();
}
async function all(path, what) {
  const out = []; let next = path;
  while (next) {
    const page = await confluence(next, what);
    out.push(...(page.results ?? []));
    next = page._links?.next ? page._links.next.replace(/^\/wiki/, '') : null;
  }
  return out;
}

// ---------- GitHub ----------
const [owner, repo] = (env.GITHUB_REPOSITORY || '/').split('/');
async function gh(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    method, headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && !(method === 'POST' && path === '/labels' && res.status === 422)) throw new Error(`GitHub ${method} ${path}: HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}
const ensureLabel = (name, color) => gh('POST', '/labels', { name, color });
const openIssues = (name) => gh('GET', `/issues?state=open&labels=${encodeURIComponent(name)}&per_page=10`);

// ---------- compare ----------
const pageUrl = `https://${site}/wiki/spaces/${src.space_key}/pages/${src.page_id}`;
const MARK = /<!-- ba-watch state: (.*?) -->/g;

async function current() {
  const page = await confluence(`/api/v2/pages/${src.page_id}`, 'page');
  const state = { page: page.version?.number ?? null, message: page.version?.message || '', children: [], attachments: [] };
  if (src.include_children) {
    const desc = await all(`/api/v2/pages/${src.page_id}/descendants?limit=250`, 'descendants');
    for (const d of desc.filter((d) => d.type === 'page')) {
      const child = await confluence(`/api/v2/pages/${d.id}`, `child ${d.id}`);
      state.children.push({ id: String(d.id), title: child.title, version: child.version?.number ?? null });
    }
  }
  if (src.include_attachments) {
    const atts = await all(`/api/v2/pages/${src.page_id}/attachments?limit=250`, 'attachments');
    state.attachments = atts.map((a) => ({ id: String(a.id), title: a.title, version: a.version?.number ?? null }));
  }
  return state;
}

function differences(now) {
  const rows = [];
  if (now.page !== src.version) rows.push(['page', src.page_id, `v${src.version}`, `v${now.page}`]);
  const cmp = (kind, known = [], seen = []) => {
    const k = new Map(known.map((x) => [String(x.id), x]));
    const s = new Map(seen.map((x) => [String(x.id), x]));
    for (const [id, x] of s) {
      if (!k.has(id)) rows.push([kind, `${id} "${x.title}"`, '—', `v${x.version} (new)`]);
      else if (k.get(id).version !== x.version) rows.push([kind, `${id} "${x.title}"`, `v${k.get(id).version}`, `v${x.version}`]);
    }
    for (const [id, x] of k) if (!s.has(id)) rows.push([kind, `${id} "${x.title}"`, `v${x.version}`, 'removed']);
  };
  if (src.include_children) cmp('child page', src.children, now.children);
  if (src.include_attachments) cmp('attachment', src.attachments, now.attachments);
  return rows;
}

const table = (rows) => ['| What | Id | In ba-project.yaml | In Confluence |', '|---|---|---|---|', ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

async function reportError(err) {
  const what = err.status === 401 || err.status === 403 ? 'auth failed (token, email or scopes)' : err.status === 404 ? 'page not found' : 'request failed';
  summary(`watch: ${what} — ${err.message}`);
  await ensureLabel(errorLabel, 'd93f0b');
  if ((await openIssues(errorLabel)).length) { summary(`An open \`${errorLabel}\` issue exists — not creating another.`); return; }
  await gh('POST', '/issues', {
    title: `watch: ${what}`, labels: [errorLabel],
    body: `The weekday check of ${pageUrl} failed: \`${err.message}\`.\n\n` +
      `- 401 / 403: the BA renews the token or checks its scopes, then \`! gh secret set CONFLUENCE_API_TOKEN\`.\n` +
      `- 404: check \`source.page_id\` in \`ba-project.yaml\` and that the token's account can see the page.\n\nClose this issue when fixed.`,
  });
}

try {
  const now = await current();
  const rows = differences(now);
  const state = JSON.stringify({ page: now.page, children: now.children.map((c) => [c.id, c.version]), attachments: now.attachments.map((a) => [a.id, a.version]) });
  if (!rows.length) { summary(`No changes: page ${src.page_id} v${now.page} = ba-project.yaml.`); process.exit(0); }
  summary(table(rows));

  await ensureLabel(label, '0e8a16');
  const open = await openIssues(label);
  const body = `${table(rows)}\n\nPage: ${pageUrl}` + (now.message ? `\nVersion message: "${now.message}"` : '') +
    `\n\nNext: open the project in Claude Code and run \`/ba-sync\`. Close this issue after the sync is committed.\n\n<!-- ba-watch state: ${state} -->`;
  if (!open.length) {
    const issue = await gh('POST', '/issues', { title: `Confluence page ${src.page_id} changed: v${src.version} → v${now.page} — run /ba-sync`, labels: [label], body });
    summary(`Opened issue #${issue.number}.`);
  } else {
    const issue = open[0];
    const comments = await gh('GET', `/issues/${issue.number}/comments?per_page=100`);
    const texts = [issue.body || '', ...comments.map((c) => c.body || '')].join('\n');
    const last = [...texts.matchAll(MARK)].pop()?.[1];
    if (last === state) summary(`Issue #${issue.number} already reports this state — nothing to add.`);
    else { await gh('POST', `/issues/${issue.number}/comments`, { body: `Changed again since the last report.\n\n${body}` }); summary(`Commented on issue #${issue.number}.`); }
  }
} catch (err) {
  if (err instanceof HttpError) await reportError(err);
  else { summary(`watch: ${err.message}`); process.exit(1); }
}
