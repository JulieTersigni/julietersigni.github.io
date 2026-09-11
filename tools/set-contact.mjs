#!/usr/bin/env node
/* ==========================================================================
   set-contact.mjs — set the contact email everywhere it appears
   --------------------------------------------------------------------------
   The address appears on the Contact page and inside tools/template.html, which
   is baked into all five case study gates. Replacing it by hand invites the
   half-done edit: the Contact page updated, the gate on every case study still
   showing the old address.

     node tools/set-contact.mjs julie.tersigni@gmail.com

   Rerun the build afterwards so the template change reaches the gates.
   ========================================================================== */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const TARGETS = ['contact.html', 'index.html', 'work.html', 'about.html', 'tools/template.html'];

/* Matches a bare address and the encoded form inside mailto query strings. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/* Only rewrite addresses we recognise as ours — never a third party's. */
const OURS = /^(?:hello@julietersigni\.com|your-email@example\.com)$/i;

async function main() {
  const email = (process.argv[2] || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error(`
✗ ${email ? `"${email}" does not look like an email address.` : 'No email address given.'}

  Usage:
    node tools/set-contact.mjs julie.tersigni@gmail.com
`);
    process.exit(1);
  }

  console.log(`\nSetting contact email to ${email}\n`);

  let total = 0;
  for (const f of TARGETS) {
    const path = join(ROOT, f);
    if (!existsSync(path)) continue;

    const before = await readFile(path, 'utf8');
    let n = 0;
    const after = before.replace(EMAIL_RE, (m) => {
      if (!OURS.test(m)) return m;
      n++;
      return email;
    });

    if (n) {
      await writeFile(path, after, 'utf8');
      console.log(`  ✓ ${f.padEnd(20)} ${n} occurrence${n === 1 ? '' : 's'}`);
      total += n;
    } else {
      console.log(`  · ${f.padEnd(20)} nothing to change`);
    }
  }

  if (!total) {
    console.log(`
No placeholder addresses found. If you're changing an address that is already
real, edit it by hand — this script only replaces known placeholders so it can
never rewrite someone else's address by accident.`);
  }

  console.log(`
Rebuild so the case study gates pick up the change:

  node tools/build.mjs && node tools/verify.mjs && node tools/package.mjs
`);
}

main().catch((err) => {
  console.error(`\n✗ Failed: ${err.message}\n`);
  process.exit(1);
});
