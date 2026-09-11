#!/usr/bin/env node
/* ==========================================================================
   package.mjs — build a clean dist/ containing only publishable files
   --------------------------------------------------------------------------
   Why this exists.

   The security model rests entirely on src/ never reaching the web server. That
   is enforced by .gitignore for git-based deploys — but .gitignore does nothing
   for a drag-and-drop upload, an rsync, or a zip made by hand. GitHub's web
   uploader in particular can't see .gitignore at all, so "select everything and
   drag it in" would publish every plaintext case study, all 20 Amazon and
   Mastercard mocks, and tools/.password.

   So instead of asking anyone to remember what to leave out, this script copies
   an explicit allowlist into dist/ and then refuses to finish if anything
   sensitive slipped through. Upload dist/. Never upload the project root.

   Usage:
     node tools/package.mjs          # writes dist/ (and dist.zip if zip exists)
   ========================================================================== */

import { readFile, writeFile, mkdir, readdir, rm, cp, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = join(ROOT, 'dist');

/* --------------------------------------------------------------------------
   Allowlist — if it isn't named here, it does not ship.
   -------------------------------------------------------------------------- */
const FILES = [
  'index.html',
  'work.html',
  'about.html',
  'contact.html',
  '404.html',
  'main.css',
  'case-study.css',
  'main.js',
  'case-study.js',
  'robots.txt',
  'sitemap.xml',
];

const OPTIONAL_FILES = ['CNAME', '.nojekyll'];

const DIRS = [
  'case-studies',   // encrypted output only
  'assets',         // headshot, résumé PDF, generated resume-data.js
];

/* Anything matching these must never appear in dist/. */
const FORBIDDEN = [
  /(^|\/)src(\/|$)/,
  /\.password$/,
  /(^|\/)pw\.txt$/,
  /(^|\/)tools(\/|$)/,
  /\.DS_Store$/,
];

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(relative(base, full));
  }
  return out;
}

async function main() {
  if (!existsSync(join(ROOT, 'case-studies', 'prime-video.html'))) {
    console.error('\n✗ case-studies/ looks empty. Run `node tools/build.mjs` first.\n');
    process.exit(1);
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  console.log('\nPackaging publishable files into dist/\n');

  let count = 0;
  for (const f of [...FILES, ...OPTIONAL_FILES]) {
    const from = join(ROOT, f);
    if (!existsSync(from)) {
      if (FILES.includes(f)) throw new Error(`missing required file ${f}`);
      continue;
    }
    await cp(from, join(DIST, f));
    console.log(`  · ${f}`);
    count++;
  }

  for (const d of DIRS) {
    const from = join(ROOT, d);
    if (!existsSync(from)) continue;
    // filter keeps .DS_Store and any stray dotfile out of the copy
    await cp(from, join(DIST, d), {
      recursive: true,
      filter: (s) => !/(\.DS_Store|\/\._)/.test(s),
    });
    const n = (await walk(join(DIST, d))).length;
    console.log(`  · ${d}/  (${n} files)`);
    count += n;
  }

  /* ------------------------------------------------------------------------
     Refuse to hand over a bundle that leaks.
     ------------------------------------------------------------------------ */
  const shipped = await walk(DIST);
  const violations = shipped.filter((p) => FORBIDDEN.some((re) => re.test(p)));
  if (violations.length) {
    console.error(`\n✗ dist/ contains files that must never be published:\n`);
    violations.forEach((v) => console.error(`    ${v}`));
    console.error('');
    await rm(DIST, { recursive: true, force: true });
    process.exit(1);
  }

  // Belt and braces: grep every shipped text file for a known plaintext phrase.
  const CANARY = 'capture viewer sentiment during ads';
  for (const p of shipped) {
    if (!/\.(html?|css|js|txt|xml|json|md)$/i.test(p)) continue;
    const body = await readFile(join(DIST, p), 'utf8');
    if (body.includes(CANARY)) {
      console.error(`\n✗ ${p} contains plaintext case study copy — aborting\n`);
      await rm(DIST, { recursive: true, force: true });
      process.exit(1);
    }
  }

  /* ------------------------------------------------------------------------
     Pre-publish gate — unresolved placeholders must not go live.
     --------------------------------------------------------------------------
     This is the last moment before the site is public, so it is the right place
     to refuse. Pass --allow-placeholders to build anyway for a local preview.
     ------------------------------------------------------------------------ */
  const PLACEHOLDERS = [
    { needle: 'your-email@example.com', hard: true,
      why: 'The contact email is still a placeholder, so every "email me" link is dead.\n      Fix: node tools/set-contact.mjs <address>' },
    { needle: 'jt:copy-slot', hard: false,
      why: 'Interim copy is still in place (bridging sentences I wrote, not Julie\'s).\n      Fine to publish, but her own words are better. Search for jt:copy-slot.' },
  ];

  const hits = new Map();
  for (const p of shipped) {
    if (!/\.(html?|txt|xml)$/i.test(p)) continue;
    const body = await readFile(join(DIST, p), 'utf8');
    for (const ph of PLACEHOLDERS) {
      if (!body.includes(ph.needle)) continue;
      if (!hits.has(ph.needle)) hits.set(ph.needle, { ph, files: [] });
      hits.get(ph.needle).files.push(p);
    }
  }

  const blocking = [...hits.values()].filter((h) => h.ph.hard);
  const advisory = [...hits.values()].filter((h) => !h.ph.hard);

  for (const { ph, files } of advisory) {
    console.log(`\n  ! ${ph.why}\n      ${files.length} file(s)`);
  }

  if (blocking.length && !process.argv.includes('--allow-placeholders')) {
    console.error('\n  ✗ NOT READY TO PUBLISH\n');
    for (const { ph, files } of blocking) {
      console.error(`    ${ph.why}`);
      console.error(`      In: ${files.join(', ')}`);
    }
    console.error(`
    dist/ is built and safe to preview locally — just don't upload it yet.
    Re-run with --allow-placeholders if you mean to publish anyway.
`);
    process.exit(1);
  }

  let bytes = 0;
  for (const p of shipped) bytes += (await stat(join(DIST, p))).size;

  console.log(`\n  ✓ ${shipped.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log('  ✓ no src/, no tools/, no password, no plaintext copy');

  /* Zip it if the system has zip, so there's a single thing to hand over.
     Delete first: `zip -r` merges into an existing archive, so a file removed
     from the allowlist would otherwise survive in dist.zip indefinitely. */
  await rm(join(ROOT, 'dist.zip'), { force: true });
  const zip = spawnSync('zip', ['-rq', join(ROOT, 'dist.zip'), '.'], { cwd: DIST });
  if (zip.status === 0) {
    const z = await stat(join(ROOT, 'dist.zip'));
    console.log(`  ✓ dist.zip  ${(z.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log('  · zip not available — upload the dist/ folder contents directly');
  }

  console.log(`
Upload the CONTENTS of dist/ — not the project root, and not dist/ itself.
Everything in there is safe to make public.
`);
}

main().catch((err) => {
  console.error(`\n✗ Packaging failed: ${err.message}\n`);
  process.exit(1);
});
