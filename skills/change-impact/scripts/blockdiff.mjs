#!/usr/bin/env node
// BA kit — deterministic helper for /ba-sync (skill change-impact). Node >= 18, no dependencies.
// Reads snapshots written by ingest-confluence (docs/00-source/confluence/<pageId>/v<N>/page.html)
// and the project's markdown artifacts. Never writes anywhere except --out.
//
//   node blockdiff.mjs diff   --root <confluence dir> --page <id>:<old|->:<new|-> [--page …] [--docs <docs dir>] --out <file.json>
//   node blockdiff.mjs quotes --root <confluence dir> --page <id>:<version> [--page …] --docs <docs dir> [--out <file.json>]
//
// diff:   block diff old ↔ new per page (block = heading / paragraph / list item / table row);
//         op: cosmetic | modified | added | removed | moved; for each change the artifact lines whose
//         source quotes are found in the old block (hits), and whether the quote is still in the new page.
// quotes: every quote on an artifact line that cites a source ([KEY · Section]) is looked up in the
//         given snapshots; prints found / missing (trace check before and after a sync).

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

// ---------- args ----------
const [cmd, ...rest] = process.argv.slice(2);
const args = { page: [] };
for (let i = 0; i < rest.length; i += 2) {
  const k = rest[i]?.replace(/^--/, '');
  if (k === 'page') args.page.push(rest[i + 1]);
  else args[k] = rest[i + 1];
}
if (!['diff', 'quotes'].includes(cmd) || !args.root || args.page.length === 0) {
  console.error('usage: blockdiff.mjs diff|quotes --root <confluence dir> --page <id>:<old|->:<new|-> … [--docs <dir>] [--out <file>]');
  process.exit(2);
}

// ---------- html → blocks ----------
const ENT = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const norm = (s) => s.replace(/ /g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const qnorm = (s) => norm(s).toLowerCase()
  .replace(/\\([~*_`#\[\]().!-])/g, '$1')       // markdown escapes kept by ingest (\~, \*)
  .replace(/\*\*|__|`/g, '')                     // bold / code marks inside quotes
  .replace(/[–—]/g, '-');

const BLOCK = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'tr', 'pre']);
const CONTAINER_OF_P = new Set(['li', 'td', 'th']);

function parseBlocks(html) {
  const blocks = [];
  const heads = [];                // heads[level] = text
  let cur = null;                  // open block {tag, start, text, strong, firstStrong}
  const stack = [];                // open element tags
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  const path = () => heads.slice(2).filter(Boolean);
  const flush = (end) => {
    if (!cur) return;
    const text = norm(decode(cur.text));
    if (text) {
      const raw = html.slice(cur.start, end).trim();
      let kind = cur.tag;
      // a paragraph that is only bold text acts as a level-3 heading ("**Capacity limits**")
      if (kind === 'p' && cur.strongAll && norm(decode(cur.strongText)) === text) {
        heads[3] = text.replace(/:$/, ''); heads.length = 4;
        kind = 'h3';
      }
      if (/^h[1-6]$/.test(kind) && kind !== cur.tag) { /* pseudo heading already set */ }
      else if (/^h[1-6]$/.test(kind)) { const l = +kind[1]; heads[l] = text; heads.length = l + 1; }
      const label = kind === 'p' || kind === 'li'
        ? (cur.firstStrong && /:$/.test(norm(decode(cur.firstStrong))) && text.startsWith(norm(decode(cur.firstStrong)))
          ? norm(decode(cur.firstStrong)).replace(/:$/, '') : null)
        : null;
      blocks.push({ index: blocks.length, kind, path: /^h[1-6]$/.test(kind) ? path().slice(0, -1) : path(), label, text, raw });
    }
    cur = null;
  };
  while ((m = re.exec(html))) {
    const [all, close, tagRaw, , selfClose, txt] = m;
    if (txt !== undefined) { if (cur) { cur.text += txt; if (cur.inStrong) cur.strongText += txt; else if (txt.trim()) cur.strongAll = false; if (cur.inStrong && cur.firstStrongOpen) cur.firstStrong += txt; } continue; }
    const tag = tagRaw.toLowerCase();
    if (tag === 'br') { if (cur) cur.text += ' '; continue; }
    if (tag === 'td' || tag === 'th') { if (!close && cur && cur.tag === 'tr' && cur.cells++ > 0) cur.text += ' | '; }
    if (tag === 'strong' || tag === 'b') {
      if (cur) {
        if (!close) { cur.inStrong = true; if (cur.firstStrong === '' && !cur.text.trim()) cur.firstStrongOpen = true; }
        else { cur.inStrong = false; cur.firstStrongOpen = false; }
      }
      continue;
    }
    if (!BLOCK.has(tag)) {
      if (!close && !selfClose && !/^(img|hr|ac:|ri:)/.test(tag)) stack.push(tag);
      else if (close) { const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i; }
      // a nested list inside a list item: the item's own text ends here
      if (!close && (tag === 'ul' || tag === 'ol') && cur && cur.tag === 'li') flush(m.index);
      continue;
    }
    if (!close) {
      if (tag === 'p' && cur && CONTAINER_OF_P.has(cur.tag === 'tr' ? 'td' : cur.tag)) { stack.push('p'); continue; }
      if (tag === 'p' && cur && cur.tag === 'tr') { stack.push('p'); continue; }
      flush(m.index);
      cur = { tag, start: m.index, text: '', strongText: '', strongAll: true, inStrong: false, firstStrong: '', firstStrongOpen: false, cells: 0 };
      stack.push(tag);
    } else {
      const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i;
      if (cur && cur.tag === tag) flush(m.index + all.length);
    }
  }
  flush(html.length);
  return blocks;
}

// ---------- similarity ----------
const words = (s) => qnorm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const numbers = (s) => (norm(s).match(/\d+(?:[.:,]\d+)*/g) || []);
function dice(a, b) {
  const A = words(a), B = words(b);
  if (!A.length && !B.length) return 1;
  const count = new Map(); A.forEach((w) => count.set(w, (count.get(w) || 0) + 1));
  let inter = 0; B.forEach((w) => { const c = count.get(w); if (c) { inter++; count.set(w, c - 1); } });
  return (2 * inter) / (A.length + B.length);
}
function wordDiff(a, b) {
  const A = words(a), B = words(b);
  const ca = new Map(); A.forEach((w) => ca.set(w, (ca.get(w) || 0) + 1));
  const cb = new Map(); B.forEach((w) => cb.set(w, (cb.get(w) || 0) + 1));
  const removed = [], added = [];
  for (const [w, n] of ca) for (let i = 0; i < n - (cb.get(w) || 0); i++) removed.push(w);
  for (const [w, n] of cb) for (let i = 0; i < n - (ca.get(w) || 0); i++) added.push(w);
  return { removed, added };
}

// ---------- block diff ----------
function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return pairs;
}
const where = (b) => b && { index: b.index, kind: b.kind, path: b.path, label: b.label, text: b.text };

function diffPage(oldB, newB) {
  const changes = [];
  const pairs = lcs(oldB.map((b) => b.text), newB.map((b) => b.text));
  const runs = []; let pi = 0, pj = 0;
  for (const [i, j] of [...pairs, [oldB.length, newB.length]]) {
    if (i > pi || j > pj) runs.push({ old: oldB.slice(pi, i), new: newB.slice(pj, j) });
    if (i < oldB.length) {
      const o = oldB[i], n = newB[j];
      if (o.raw.replace(/\s+/g, ' ') !== n.raw.replace(/\s+/g, ' ')) changes.push({ op: 'cosmetic', old: where(o), new: where(n), hint: 'C0' });
    }
    pi = i + 1; pj = j + 1;
  }
  const removed = [], added = [];
  for (const r of runs) {
    const free = new Set(r.new.map((_, k) => k));
    for (const o of r.old) {
      let best = -1, bestS = 0;
      for (const k of free) { const s = dice(o.text, r.new[k].text) + (o.kind === r.new[k].kind ? 0.01 : 0); if (s > bestS) { bestS = s; best = k; } }
      if (best >= 0 && bestS >= 0.5) {
        const n = r.new[best]; free.delete(best);
        const no = numbers(o.text), nn = numbers(n.text);
        const numbersChanged = no.join('|') !== nn.join('|');
        changes.push({ op: 'modified', old: where(o), new: where(n), similarity: +bestS.toFixed(2),
          numbers: numbersChanged ? { old: no, new: nn } : undefined, words: wordDiff(o.text, n.text),
          hint: !numbersChanged && bestS >= 0.8 ? 'C1?' : null });
      } else removed.push(o);
    }
    for (const k of free) added.push(r.new[k]);
  }
  for (const o of removed) {
    const k = added.findIndex((n) => n.text === o.text);
    if (k >= 0) { changes.push({ op: 'moved', old: where(o), new: where(added[k]), hint: null }); added.splice(k, 1); }
    else changes.push({ op: 'removed', old: where(o), new: null, hint: null });
  }
  for (const n of added) changes.push({ op: 'added', old: null, new: where(n), hint: null });
  const pos = (c) => (c.new ?? c.old).index + (c.new ? 0 : 0.5);
  return changes.sort((a, b) => pos(a) - pos(b));
}

// ---------- artifact quotes ----------
const ID = /\b(?:REQ|NFR|CST|OOS|DEC|CON|GAP|ASM|RSK|SI|US|EP|CHG|O)-\d+\b/;
const SOURCE_REF = /\[([A-Z][A-Z0-9]{0,5}) · [^\]]+\]/;
const SKIP_DIRS = new Set(['00-source', '07-changes', 'test-reports', '.ba']);

function mdFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(e)) out.push(...mdFiles(p)); }
    // review.md quotes other artifacts, not the source
    else if (e.endsWith('.md') && !['run-log.md', 'README.md', 'review.md'].includes(e)) out.push(p);
  }
  return out;
}

function artifactQuotes(docs) {
  const quotes = [];
  for (const file of mdFiles(docs)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const fileId = (basename(file).match(ID) || [])[0] || null;
    let headingId = null;
    lines.forEach((line, i) => {
      if (/^#{1,6} /.test(line)) headingId = (line.match(ID) || [])[0] || headingId;
      if (!SOURCE_REF.test(line)) return;
      const rowId = (line.match(/^\|\s*\**([A-Z]{1,3}-\d+)/) || [])[1];
      const item = rowId || headingId || fileId || (line.match(ID) || [])[0] || null;
      // section names may contain quotes ([CTX · What "done" looks like]) and quotes may contain \" — mask both
      const text = line.replace(new RegExp(SOURCE_REF.source, 'g'), ' ').replace(/\\"/g, '\u0001');
      const re = /"([^"]*)"|“([^”]*)”/g; let q;   // pair every quote mark, then drop short ones ("Agreed")
      while ((q = re.exec(text))) {
        const quote = (q[1] ?? q[2]).replace(/\u0001/g, '"');
        if (quote.length < 8 || / \| /.test(quote)) continue;   // too short, or spans table cells — not a quote
        const fragments = quote.split(/…|\.\.\.|\[…\]/).map((f) => qnorm(f).replace(/^[\s,.;:]+|[\s,.;:]+$/g, '')).filter((f) => f.length >= 4);
        if (fragments.length) quotes.push({ file: relative(process.cwd(), file).replace(/\\/g, '/'), line: i + 1, item, quote, fragments });
      }
    });
  }
  return quotes;
}

// a quote is found in a page when every fragment is inside one of its blocks; returns the blocks used
function locate(q, blocks) {
  const used = new Set();
  for (const f of q.fragments) {
    const b = blocks.find((b) => qnorm(b.text).includes(f));
    if (!b) return null;
    used.add(b.index);
  }
  return used;
}

// ---------- io ----------
function loadBlocks(root, id, v) {
  const f = join(root, id, `v${v}`, 'page.html');
  if (!existsSync(f)) { console.error(`snapshot not found: ${f}`); process.exit(1); }
  return parseBlocks(readFileSync(f, 'utf8'));
}
const write = (obj) => {
  const json = JSON.stringify(obj, null, 2) + '\n';
  if (args.out) writeFileSync(args.out, json); else process.stdout.write(json);
};

if (cmd === 'diff') {
  const quotes = args.docs ? artifactQuotes(args.docs) : [];
  const pages = []; let n = 0;
  for (const spec of args.page) {
    const [id, ov, nv] = spec.split(':');
    const oldB = ov === '-' ? [] : loadBlocks(args.root, id, ov);
    const newB = nv === '-' ? [] : loadBlocks(args.root, id, nv);
    const changes = diffPage(oldB, newB);
    const located = quotes.map((q) => ({ q, old: locate(q, oldB), new: locate(q, newB) })).filter((x) => x.old);
    for (const c of changes) {
      c.id = `D${++n}`;
      if (c.old && c.op !== 'cosmetic') {
        c.hits = located.filter((x) => x.old.has(c.old.index))
          .map((x) => ({ file: x.q.file, line: x.q.line, item: x.q.item, quote: x.q.quote, still_in_new: !!x.new }));
      }
    }
    const count = {}; changes.forEach((c) => (count[c.op] = (count[c.op] || 0) + 1));
    pages.push({ page_id: id, old_version: ov === '-' ? null : +ov, new_version: nv === '-' ? null : +nv,
      page_op: ov === '-' ? 'page added' : nv === '-' ? 'page removed' : 'page changed',
      blocks: { old: oldB.length, new: newB.length }, count, changes });
  }
  write({ generated_by: 'change-impact/scripts/blockdiff.mjs', generated_at: new Date().toISOString(), quotes_scanned: quotes.length, pages });
  for (const p of pages) console.error(`${p.page_id} v${p.old_version ?? '-'} → v${p.new_version ?? '-'}: ${JSON.stringify(p.count)}; quote hits ${p.changes.reduce((s, c) => s + (c.hits?.length || 0), 0)}`);
} else {
  if (!args.docs) { console.error('quotes needs --docs'); process.exit(2); }
  const blocks = args.page.flatMap((spec) => { const [id, v] = spec.split(':'); return loadBlocks(args.root, id, v); });
  const quotes = artifactQuotes(args.docs);
  const missing = quotes.filter((q) => !locate(q, blocks))
    .map((q) => ({ file: q.file, line: q.line, item: q.item, quote: q.quote, fragments_missing: q.fragments.filter((f) => !blocks.some((b) => qnorm(b.text).includes(f))) }));
  write({ generated_by: 'change-impact/scripts/blockdiff.mjs', generated_at: new Date().toISOString(), pages: args.page, total: quotes.length, found: quotes.length - missing.length, missing });
  console.error(`quotes: ${quotes.length - missing.length} / ${quotes.length} found; missing ${missing.length}`);
}
