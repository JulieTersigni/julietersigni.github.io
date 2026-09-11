#!/usr/bin/env node
/* ==========================================================================
   set-site-url.mjs — point the site at its public URL
   --------------------------------------------------------------------------
   The absolute URL appears in canonical tags, Open Graph tags, robots.txt, and
   sitemap.xml. Those have to be absolute — a relative canonical is meaningless
   — so they can't just be left blank.

   Rather than hand-editing a dozen places, set them all at once:

     node tools/set-site-url.mjs https://julietersigni.github.io
     node tools/set-site-url.mjs https://julietersigni.com     # if a domain is added later

   Passing a custom domain also writes the CNAME file GitHub Pages needs.
   Passing a github.io URL removes it again.
   ========================================================================== */

import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const TARGETS = [
  'index.html', 'work.html', 'about.html', 'contact.html', '404.html',
  'robots.txt', 'sitemap.xml',
];

/* Any origin we might be migrating away from. */
const KNOWN = /https:\/\/(?:[a-z0-9-]+\.)*(?:julietersigni\.com|[a-z0-9-]+\.github\.io)/gi;

function usage(msg) {
  console.error(`\n✗ ${msg}

  Usage:
    node tools/set-site-url.mjs https://julietersigni.github.io
    node tools/set-site-url.mjs https://julietersigni.com
`);
  process.exit(1);
}

async function main() {
  const raw = process.argv[2];
  if (!raw) usage('No URL given.');

  let url;
  try {
    url = new URL(raw);
  } catch {
    usage(`"${raw}" is not a valid URL.`);
  }
  if (url.protocol !== 'https:') usage('The URL must start with https:// — GitHub Pages serves HTTPS, and the case study decryption requires a secure origin.');
  if (url.pathname !== '/') usage(`The URL must be a bare origin with no path. Got "${url.pathname}".\n\n  If your repository is NOT named <username>.github.io the site will live in a\n  subfolder, which breaks 404.html. Rename the repository instead.`);

  const origin = url.origin;
  const isGitHubDefault = /\.github\.io$/i.test(url.hostname);

  console.log(`\nSetting site URL to ${origin}\n`);

  let touched = 0;
  for (const f of TARGETS) {
    const path = join(ROOT, f);
    if (!existsSync(path)) continue;
    const before = await readFile(path, 'utf8');
    const after = before.replace(KNOWN, origin);
    if (after !== before) {
      await writeFile(path, after, 'utf8');
      const n = (before.match(KNOWN) || []).length;
      console.log(`  ✓ ${f.padEnd(14)} ${n} URL${n === 1 ? '' : 's'} updated`);
      touched++;
    } else {
      console.log(`  · ${f.padEnd(14)} already correct`);
    }
  }

  /* ---- CNAME: only for a custom domain ---------------------------------- */
  const cname = join(ROOT, 'CNAME');
  if (isGitHubDefault) {
    if (existsSync(cname)) {
      await rm(cname);
      console.log('  ✓ CNAME          removed (not needed for a github.io URL)');
    }
  } else {
    await writeFile(cname, url.hostname + '\n', 'utf8');
    console.log(`  ✓ CNAME          written (${url.hostname})`);
  }

  console.log(`
Now rebuild so the change reaches the published pages and dist/:

  node tools/build.mjs && node tools/verify.mjs && node tools/package.mjs
`);

  if (isGitHubDefault) {
    console.log(`Reminder: the repository must be named exactly "${url.hostname}".
404.html uses root-absolute paths (/main.css, /work.html), which only resolve if
the site sits at the domain root. A repository with any other name publishes to
/<repo-name>/ and the 404 page would lose its styling and navigation.
`);
  }
}

main().catch((err) => {
  console.error(`\n✗ Failed: ${err.message}\n`);
  process.exit(1);
});
