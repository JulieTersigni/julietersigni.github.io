#!/usr/bin/env node
/* ==========================================================================
   build.mjs — encrypt the case studies into publishable pages
   --------------------------------------------------------------------------
   Reads plaintext case study markup from src/case-studies/, inlines the mock
   images from src/mocks/ as data URIs, encrypts the result with AES-256-GCM,
   and writes it into case-studies/<slug>.html.

   Nothing in src/ is ever published — see .gitignore. The published pages
   contain ciphertext only: no hidden copy in the page source, and no image
   URL that can be fetched, hotlinked, or indexed.

   Usage:
     node tools/build.mjs                              # password from tools/.password
     PORTFOLIO_PASSWORD='secret' node tools/build.mjs
   ========================================================================== */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const PBKDF2_ITERATIONS = 250000;

/* --------------------------------------------------------------------------
   Case study manifest
   --------------------------------------------------------------------------
   Order drives the prev/next navigation and the "Case study N of 5" counter.
   It matches the numbering on work.html — keep the two in step.
   -------------------------------------------------------------------------- */
const CASE_STUDIES = [
  { slug: 'prime-video',          number: '01', title: 'Prime Video Interactive Ad Experiences' },
  { slug: 'brand-store-quality',  number: '02', title: 'Brand Store Quality Rating' },
  { slug: 'click-to-pay',         number: '03', title: 'Click to Pay Error Messaging' },
];

/* Creator Connections (01) and Ads Agent (02) are listed on work.html as
   coming-soon entries with no link. They deliberately have no page here: Julie
   asked that unfinished work not be presented as a live page. Add them back to
   this array when her content arrives. */

/* --------------------------------------------------------------------------
   Password
   -------------------------------------------------------------------------- */
async function getPassword() {
  if (process.env.PORTFOLIO_PASSWORD) return process.env.PORTFOLIO_PASSWORD.trim();

  const file = join(HERE, '.password');
  if (existsSync(file)) {
    const value = (await readFile(file, 'utf8')).trim();
    if (value) return value;
  }

  console.error(`
✗ No password found.

  Create tools/.password containing the password, for example:

      echo 'your-password-here' > tools/.password

  …or pass it inline:

      PORTFOLIO_PASSWORD='your-password-here' node tools/build.mjs

  tools/.password is gitignored and never published.
`);
  process.exit(1);
}

/* --------------------------------------------------------------------------
   Inline mock images as data URIs
   --------------------------------------------------------------------------
   This is the step that removes fetchable image URLs. Encrypting the markup
   while serving images from a public directory would protect nothing.
   -------------------------------------------------------------------------- */
const imageCache = new Map();

async function inlineImages(html, slug) {
  const tokens = [...html.matchAll(/\{\{IMG:([a-z0-9-]+)\}\}/gi)];
  let out = html;

  for (const [token, name] of tokens) {
    if (!imageCache.has(name)) {
      const path = join(ROOT, 'src', 'mocks', `${name}.jpg`);
      if (!existsSync(path)) {
        throw new Error(`${slug}: missing image src/mocks/${name}.jpg`);
      }
      const buf = await readFile(path);
      imageCache.set(name, `data:image/jpeg;base64,${buf.toString('base64')}`);
    }
    out = out.split(token).join(imageCache.get(name));
  }

  // A token left behind means a typo in the slug — fail loudly rather than
  // publishing a page with a literal {{IMG:…}} in it.
  const leftover = out.match(/\{\{IMG:[^}]*\}\}/);
  if (leftover) throw new Error(`${slug}: unresolved image token ${leftover[0]}`);

  return out;
}

/* --------------------------------------------------------------------------
   Encrypt
   --------------------------------------------------------------------------
   Fresh salt and IV per page — generated inside the loop so they are never
   reused across case studies. A wrong password fails the GCM authentication
   tag, so failed decryption *is* the wrong-password path; there is no password
   hash stored anywhere to attack.
   -------------------------------------------------------------------------- */
async function deriveKey(password, salt, iterations, usages) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
}

/* --------------------------------------------------------------------------
   Round-trip assertion
   --------------------------------------------------------------------------
   The obvious guard — grepping the payload for source markup — cannot work: the
   ciphertext is base64, and base64 contains neither "-" nor ":", so canaries
   like "cs-block" or "data:image/jpeg" can never match however broken the
   encryption is. The only guard that actually proves encryption happened is
   decrypting the payload back and comparing it to the input.
   -------------------------------------------------------------------------- */
async function assertRoundTrip(payload, password, expected, slug) {
  const b = (x) => new Uint8Array(Buffer.from(x, 'base64'));

  // 1. The payload must not be a plain base64 copy of the source.
  let decoded = '';
  try {
    decoded = Buffer.from(payload.ct, 'base64').toString('utf8');
  } catch { /* not valid UTF-8, which is what we expect */ }
  if (decoded.includes('cs-head') || decoded.includes('cs-block')) {
    throw new Error(`${slug}: payload base64-decodes to source markup — NOT ENCRYPTED`);
  }

  // 2. The right password must reproduce the input exactly.
  const key = await deriveKey(password, b(payload.salt), payload.iterations, ['decrypt']);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(payload.iv) }, key, b(payload.ct));
  if (new TextDecoder().decode(buf) !== expected) {
    throw new Error(`${slug}: round-trip mismatch — decrypted output differs from source`);
  }

  // 3. A wrong password must fail the GCM tag.
  try {
    const bad = await deriveKey(password + 'x', b(payload.salt), payload.iterations, ['decrypt']);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(payload.iv) }, bad, b(payload.ct));
    throw new Error(`${slug}: a wrong password decrypted successfully — aborting`);
  } catch (err) {
    if (err.message.includes('wrong password decrypted')) throw err;
  }
}

async function encrypt(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS, ['encrypt']);

  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const b64 = (bytes) => Buffer.from(bytes).toString('base64');

  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(new Uint8Array(ct)),
  };
}

/* --------------------------------------------------------------------------
   Prev / next navigation
   -------------------------------------------------------------------------- */
function buildNav(index) {
  const prev = CASE_STUDIES[index - 1];
  const next = CASE_STUDIES[index + 1];

  const arrowLeft = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>`;
  const arrowRight = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  const left = prev
    ? `<a class="cs-nav-link cs-nav-link--prev" href="${prev.slug}.html">${arrowLeft} ${prev.title}</a>`
    : `<a class="cs-nav-link cs-nav-link--prev" href="../work.html">${arrowLeft} All work</a>`;

  const right = next
    ? `<a class="cs-nav-link cs-nav-link--next" href="${next.slug}.html">${next.title} ${arrowRight}</a>`
    : `<a class="cs-nav-link cs-nav-link--next" href="../contact.html">Get in touch ${arrowRight}</a>`;

  const count = String(CASE_STUDIES.length).padStart(2, '0');
  return `${left}\n      <span class="cs-nav-meta">Case study ${CASE_STUDIES[index].number} of ${count}</span>\n      ${right}`;
}

/* --------------------------------------------------------------------------
   Résumé
   --------------------------------------------------------------------------
   Emits assets/resume-data.js, which does two jobs:

     1. Tells main.js whether a résumé PDF exists at all, so the download
        button can enable itself rather than 404. Drop the PDF into assets/,
        rerun this script, and the Contact page updates with no HTML edit.
     2. Carries a base64 copy so the download can be forced even where
        fetch() is unavailable (notably file://).
   -------------------------------------------------------------------------- */
async function buildResumeData() {
  const assetsDir = join(ROOT, 'assets');
  await mkdir(assetsDir, { recursive: true });

  let found = null;
  if (existsSync(assetsDir)) {
    const entries = await readdir(assetsDir);
    found = entries.find(
      (f) => extname(f).toLowerCase() === '.pdf' && /resume|r[eé]sum[eé]|cv/i.test(f)
    ) || null;
  }

  const outPath = join(assetsDir, 'resume-data.js');
  const header = `/* Generated by tools/build.mjs — do not edit by hand.
   Regenerate with: node tools/build.mjs */\n`;

  if (!found) {
    await writeFile(outPath, `${header}window.__JT_RESUME__ = { available: false };\n`, 'utf8');
    console.log('  · assets/resume-data.js   no PDF found → download button stays hidden');
    return;
  }

  const b64 = (await readFile(join(assetsDir, found))).toString('base64');
  const out = `${header}window.__JT_RESUME__ = {
  available: true,
  filename: ${JSON.stringify(found)},
  type: "application/pdf",
  b64: "${b64}"
};
`;
  await writeFile(outPath, out, 'utf8');
  console.log(
    `  ✓ assets/resume-data.js   ${found}  (${(Buffer.byteLength(out) / 1024).toFixed(0)} KB fallback)`
  );
}

/* --------------------------------------------------------------------------
   Main
   -------------------------------------------------------------------------- */
async function main() {
  const password = await getPassword();
  const template = await readFile(join(HERE, 'template.html'), 'utf8');
  const outDir = join(ROOT, 'case-studies');
  await mkdir(outDir, { recursive: true });

  console.log(
    `\nEncrypting ${CASE_STUDIES.length} case studies ` +
    `(AES-256-GCM, PBKDF2-SHA256 ×${PBKDF2_ITERATIONS.toLocaleString()})\n`
  );

  for (let i = 0; i < CASE_STUDIES.length; i++) {
    const cs = CASE_STUDIES[i];
    const srcPath = join(ROOT, 'src', 'case-studies', `${cs.slug}.html`);

    if (!existsSync(srcPath)) {
      throw new Error(`missing source src/case-studies/${cs.slug}.html`);
    }

    let body = await readFile(srcPath, 'utf8');
    const plainBytes = Buffer.byteLength(body, 'utf8');
    body = await inlineImages(body, cs.slug);

    const payload = await encrypt(body, password);
    await assertRoundTrip(payload, password, body, cs.slug);

    const page = template
      .replaceAll('{{TITLE}}', cs.title)
      .replaceAll('{{NUMBER}}', cs.number)
      .replaceAll('{{NAV}}', buildNav(i))
      .replaceAll('{{PAYLOAD}}', JSON.stringify(payload));

    await writeFile(join(outDir, `${cs.slug}.html`), page, 'utf8');

    const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
    console.log(
      `  ✓ ${cs.slug.padEnd(21)} ${kb(plainBytes).padStart(8)} markup ` +
      `→ ${kb(Buffer.byteLength(page, 'utf8')).padStart(9)} encrypted page  ` +
      `round-trip verified`
    );
  }

  console.log('\nDone. Published pages contain ciphertext only.\n');

  await buildResumeData();

  console.log(`
  Password: ${'•'.repeat(password.length)}  (${password.length} characters)

Test over http — Safari treats file:// as an insecure origin, so the case study
decryption will not run if you just double-click the file:

  python3 -m http.server 8000
  open http://localhost:8000
`);
}

main().catch((err) => {
  console.error(`\n✗ Build failed: ${err.message}\n`);
  process.exit(1);
});
