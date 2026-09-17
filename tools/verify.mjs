#!/usr/bin/env node
/* ==========================================================================
   verify.mjs — prove the published pages are actually encrypted
   --------------------------------------------------------------------------
   Replicates the browser's decryption path in Node and runs it against the
   *published* files in case-studies/. This catches real bugs — an unencrypted
   payload, an unresolved image token, a leaked phrase — without needing a
   browser.

   Run it after every build:
     node tools/verify.mjs
   ========================================================================== */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { failures++; console.log(`  ✗ ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

/* -------------------------------------------------------------------------- */
async function getPassword() {
  if (process.env.PORTFOLIO_PASSWORD) return process.env.PORTFOLIO_PASSWORD.trim();
  const file = join(HERE, '.password');
  if (existsSync(file)) {
    const value = (await readFile(file, 'utf8')).trim();
    // An empty file would otherwise derive a key from '' and report every page
    // as failing to decrypt — a confusing way to learn the file is blank.
    if (value) return value;
    console.error('\n✗ tools/.password is empty.\n');
    process.exit(1);
  }
  console.error('\n✗ No password. Set PORTFOLIO_PASSWORD or create tools/.password\n');
  process.exit(1);
}

function b64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/* Mirrors case-study.js exactly. */
async function decrypt(payload, password) {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(payload.salt), iterations: payload.iterations, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(payload.iv) }, key, b64ToBytes(payload.ct)
  );
  return new TextDecoder().decode(buf);
}

function extractPayload(html) {
  const m = html.match(/<script type="application\/json" id="csPayload">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no csPayload block found');
  return JSON.parse(m[1]);
}

/* --------------------------------------------------------------------------
   Leak canaries
   --------------------------------------------------------------------------
   These used to be a hand-written list of phrases. That rots: rewording the copy
   silently orphans a canary, and the check then passes because the phrase no
   longer exists anywhere — false assurance exactly when the content changed.
   Four of eight had died that way.

   Instead, derive them from the text we just decrypted. The canaries are then, by
   construction, always the current content, and `derived N canaries` below fails
   loudly if we ever end up checking nothing.

   Comparison is whitespace-normalised, because a leak would reproduce the
   source's line wrapping — a literal match against a phrase that spans two lines
   could never fire.
   -------------------------------------------------------------------------- */
const flat = (s) => s.replace(/\s+/g, ' ').trim();

// Text Julie publishes herself (ledes, card summaries) is not a secret, so it must
// not become a canary — otherwise the repo-wide scan below flags her own homepage.
const PUBLIC_PAGES = ['index.html', 'work.html', 'about.html', 'contact.html'];
const publicText = flat(
  PUBLIC_PAGES.map((p) => {
    try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; }
  }).join(' ').replace(/<[^>]+>/g, ' ')
);

const ALL_CANARIES = new Set();

/* Block-level tags become line breaks so each <li>/<p> is its own candidate.
   Splitting on terminal punctuation alone is not enough: list items mostly don't end
   in a period, so a whole <ul> collapsed into one giant composite string. A leak of
   any single bullet is a strict substring of that blob and would never match. Inline
   tags still become spaces, so a <strong> mid-sentence doesn't split the sentence. */
const BLOCK_TAG = /<\/?(?:p|li|h[1-6]|div|section|article|figcaption|blockquote|dt|dd|ul|ol|tr|t[dh]|br)\b[^>]*>/gi;

function canariesFrom(plaintext) {
  const prose = plaintext.replace(BLOCK_TAG, '\n').replace(/<[^>]+>/g, ' ');
  const sentences = prose
    .split(/\n+|(?<=[.?!])\s+/)
    .map(flat)
    // Long enough to be body copy rather than a heading or a label. Titles are
    // legitimately public in the gate markup, so they must not be canaries.
    .filter((t) => t.length >= 60 && t.split(' ').length >= 9)
    .filter((t) => !publicText.includes(t));

  // Every qualifying sentence, not a sample. A sample makes the repo-wide scan
  // probabilistic: prose can sit in a file and simply not be one of the phrases
  // that got picked.
  return sentences;
}

async function main() {
  const password = await getPassword();
  const dir = join(ROOT, 'case-studies');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.html')).sort();

  console.log(`\nVerifying ${files.length} published case studies\n`);

  for (const file of files) {
    const html = await readFile(join(dir, file), 'utf8');
    console.log(`${file}`);

    let payload;
    try {
      payload = extractPayload(html);
    } catch (e) {
      bad(`${file}: ${e.message}`);
      continue;
    }

    // --- payload shape -----------------------------------------------------
    check(payload.alg === 'AES-GCM', 'algorithm is AES-GCM');
    check(payload.kdf === 'PBKDF2-SHA256', 'KDF is PBKDF2-SHA256');
    check(payload.iterations >= 250000, `PBKDF2 iterations ${payload.iterations.toLocaleString()} ≥ 250,000`);
    check(b64ToBytes(payload.salt).length === 16, 'salt is 16 bytes');
    check(b64ToBytes(payload.iv).length === 12, 'IV is 12 bytes');

    // --- correct password decrypts ----------------------------------------
    let plain;
    try {
      plain = await decrypt(payload, password);
      ok('correct password decrypts');
    } catch {
      bad('correct password FAILED to decrypt');
      continue;
    }

    check(plain.includes('cs-head'), 'decrypted markup looks like a case study');
    check(!/\{\{IMG:/.test(plain), 'no unresolved {{IMG:…}} tokens');
    check(!/\{\{[A-Z]+\}\}/.test(plain), 'no unresolved template tokens');

    // --- wrong passwords are rejected -------------------------------------
    const wrong = [
      password.toUpperCase(),
      password.toLowerCase() === password ? password + 'x' : password.toLowerCase(),
      password.slice(0, -1),
      password + 'x',
      '',
      'password',
      'Password123',
    ].filter((w) => w !== password);

    let rejected = 0;
    for (const w of wrong) {
      try {
        await decrypt(payload, w);
      } catch {
        rejected++;
      }
    }
    check(rejected === wrong.length, `all ${wrong.length} wrong-password variants rejected`);

    // case-study.js trims the submitted value, so surrounding whitespace is
    // forgiven in the browser. Assert that deliberately rather than pretending
    // the padded forms fail.
    let trimmedOk = true;
    for (const padded of [' ' + password, password + ' ', ' ' + password + '  ']) {
      try {
        await decrypt(payload, padded.trim());
      } catch {
        trimmedOk = false;
      }
    }
    check(trimmedOk, 'space-padded passwords still work (case-study.js trims)');

    // --- no plaintext in the published file --------------------------------
    const canaries = canariesFrom(plain);
    canaries.forEach((c) => ALL_CANARIES.add(c));
    check(canaries.length >= 5,
      `derived ${canaries.length} leak canaries from the decrypted text` +
      (canaries.length < 5 ? ' — too few to be meaningful' : ''));

    const flatHtml = flat(html);
    const leaks = canaries.filter((c) => flatHtml.includes(c));
    check(leaks.length === 0, leaks.length
      ? `PLAINTEXT LEAK (${leaks.length}): ${leaks.slice(0, 3).map((l) => l.slice(0, 60) + '…').join(' | ')}`
      : 'none of that text appears in the published file');

    // --- no fetchable image URLs ------------------------------------------
    const imgSrcs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    const external = imgSrcs.filter((s) => !s.startsWith('data:') && s !== '');
    check(external.length === 0, external.length ? `image URL in gate markup: ${external.join(', ')}` : 'no fetchable image URLs outside the ciphertext');

    console.log('');
  }

  /* ------------------------------------------------------------------------
     Repository hygiene — the whole model rests on src/ never being published.
     ------------------------------------------------------------------------ */
  console.log('repository hygiene');
  const gitignore = existsSync(join(ROOT, '.gitignore'))
    ? await readFile(join(ROOT, '.gitignore'), 'utf8')
    : '';
  check(/^src\/$/m.test(gitignore), 'src/ is gitignored');
  check(/tools\/\.password/.test(gitignore), 'tools/.password is gitignored');

  /* The repository is public, so the password must not appear in any file that
     would be committed. Writing it into a README "for reference" undoes the whole
     scheme, and is an easy mistake to make. */
  const SKIP = /(^|\/)(\.git|node_modules|src|dist)(\/|$)|\.password$|\.DS_Store$/;
  const BINARY = /\.(pdf|jpe?g|png|gif|webp|avif|ico|svgz|zip|gz|woff2?|[to]tf|eot|mp[34]|mov|webm|docx?|xlsx?|pptx?)$/i;

  /* Ask git what it would actually commit, so a .gitignore entry genuinely takes a
     file out of scope. A plain directory walk cannot tell "ignored" from "about to
     be published", and would report a deliberately excluded file forever. */
  async function scan() {
    try {
      return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        { cwd: ROOT, encoding: 'utf8' })
        .split('\0').filter(Boolean)
        .filter((p) => !SKIP.test(p))
        .map((p) => join(ROOT, p));
    } catch {
      // Not a git checkout (a client working from the zip). Fall back to a walk,
      // which is stricter: it can only over-report.
      const walk = async (dir) => {
        const out = [];
        for (const e of await readdir(dir, { withFileTypes: true })) {
          const full = join(dir, e.name);
          if (SKIP.test(relative(ROOT, full))) continue;
          if (e.isDirectory()) out.push(...(await walk(full)));
          else out.push(full);
        }
        return out;
      };
      return walk(ROOT);
    }
  }

  const exposed = [];
  const prose = [];
  for (const file of await scan()) {
    /* Skip only what is genuinely binary, then let the NUL sniff below decide.
       An extension whitelist silently exempts extensionless files (NOTES, Makefile)
       and anything unanticipated — a .sh helper, a .swift snippet — which is the
       natural home for a future accidental paste. */
    if (BINARY.test(file)) continue;
    let body;
    try { body = await readFile(file, 'utf8'); } catch { continue; }
    if (body.includes('\u0000')) continue; // binary despite the extension
    if (body.includes(password)) exposed.push(relative(ROOT, file));

    /* Encrypting the case-study pages achieves nothing if the same sentences sit in
       plaintext in a build script or a note elsewhere in the repo. A punch-list
       script did exactly that, so this scans every committable file — not just the
       pages we encrypt. */
    /* Prose pasted into source code gets broken across string-literal boundaries
       ("…rating, then " "wrote…"), which defeats a literal match. Dropping straight
       quotes and backslashes stitches it back together. Curly apostrophes, which is
       what the copy actually uses, are left alone.

       Tag stripping is applied to markup ONLY. `<[^>]+>` is not a tag matcher over
       source code: `[^>]` spans newlines, so a bare `i < n` comparison swallows
       everything up to the next `>` — an arrow function 20 lines later. That silently
       blanked a 1,474-character span of build.mjs, taking any prose in it with it. */
    const isMarkup = /\.html?$/i.test(file);
    const norm = (t, markup) =>
      flat((markup ? t.replace(/<[^>]+>/g, ' ') : t).replace(/["'\\]/g, ''));
    const flatBody = norm(body, isMarkup);
    const hits = [...ALL_CANARIES].filter((c) => flatBody.includes(norm(c, false)));
    if (hits.length) prose.push(`${relative(ROOT, file)} (${hits.length})`);
  }
  check(
    exposed.length === 0,
    exposed.length
      ? `PASSWORD LEAK — it appears in: ${exposed.join(', ')}`
      : 'the password appears in no committed file'
  );

  check(
    prose.length === 0,
    prose.length
      ? `CASE-STUDY PLAINTEXT LEAK — confidential copy appears in: ${prose.join(', ')}`
      : `no case-study prose in any committed file (${ALL_CANARIES.size} phrases checked)`
  );

  console.log(
    failures === 0
      ? '\n✓ All checks passed. The published pages contain ciphertext only.\n'
      : `\n✗ ${failures} check(s) failed.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n✗ Verify crashed: ${err.message}\n`);
  process.exit(1);
});
