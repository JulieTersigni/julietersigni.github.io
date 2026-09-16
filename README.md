# Julie Tersigni — portfolio website

A static, responsive portfolio site with genuinely encrypted case studies. No
framework, no build tooling, no dependencies to keep up with. Two Node scripts do
the encryption and verify it worked; everything else is plain HTML, CSS, and
JavaScript you can edit in any text editor.

**Live:** `https://<username>.github.io` *(free GitHub Pages — see `GITHUB-SETUP.md`)*

---

## Status

Live at **https://julietersigni.github.io** once Pages is switched on
(Settings → Pages → Deploy from a branch → main → / (root)).

Everything is in place: Julie's copy, her real contact address, the résumé PDF, and the
three completed case studies. Two projects — Creator Connections and Ads Agent — are
listed on the Work page as coming-soon entries with no page behind them; their draft
sources are parked in `src/case-studies/_pending/` and can be finished at any time
without touching anything else.

Optional, whenever she wants it: a custom domain. One command repoints the whole site —

```bash
node tools/set-site-url.mjs https://julietersigni.com
```

then follow the DNS steps in `GITHUB-SETUP.md`.

---

## The password protection

The five case studies contain unreleased and internal design work from Amazon and
Mastercard, so they are **encrypted, not hidden**.

The common way to do this on a static host is JavaScript that hides a `<div>`
until you type a password. That protects nothing: the content is fully present in
the page source, readable by anyone who opens View Source or turns JavaScript off.

Instead:

- `tools/build.mjs` reads the plaintext from `src/case-studies/`, inlines every
  mock image as a base64 data URI, and encrypts the whole thing with
  **AES-256-GCM**. The key is derived from your password with **PBKDF2-SHA256 at
  250,000 iterations**, using a fresh random salt and IV for every page.
- The published `case-studies/*.html` files contain only that ciphertext.
- `case-study.js` derives the same key in the browser and decrypts. A wrong
  password fails the GCM authentication tag, so nothing renders and there is
  nothing to reveal.

Two consequences worth knowing:

1. **The images are inside the ciphertext.** There is no `assets/mocks/screen1.jpg`
   sitting on the server for someone to fetch, hotlink, or find in image search.
   This is the part most implementations get wrong.
2. **`src/` must never be committed.** It holds the only readable copy of your
   content and the original full-resolution mocks. It is in `.gitignore`, and
   `tools/verify.mjs` checks that on every run. Don't remove it.

### The password

**The password is deliberately not written down in this file.** This README is
committed to the repository, and the repository is public — so anything written here
is readable by anyone. Recording the password here would undo the encryption
completely.

It lives in `tools/.password`, which is gitignored and never published. Joon sends
it to you separately.

`node tools/verify.mjs` checks on every run that the password does not appear in any
file that would be committed, so this can't be reintroduced by accident.

Change it whenever you like — pick something you're happy to dictate over a phone
call, then rebuild:

```bash
echo 'your-new-password' > tools/.password
node tools/build.mjs
node tools/verify.mjs
```

One password opens all five case studies. If you'd rather have a different
password per case study, that's a small change — ask.

---

## Editing the site

### Public pages

`index.html`, `work.html`, `about.html`, `contact.html`, and `404.html` are
ordinary HTML. Open one, change the words, save, commit. Nothing to compile.

Each page repeats its own navigation and footer. If you change a nav item, change
it in all five plus `tools/template.html` — five minutes with find-and-replace.

### Case studies

**Never edit `case-studies/*.html` directly** — those are the encrypted output and
will be overwritten. Edit the plaintext in `src/case-studies/` instead, then
rebuild.

```bash
# 1. edit src/case-studies/prime-video.html
# 2. rebuild and verify
node tools/build.mjs
node tools/verify.mjs
# 3. commit and push
git add -A && git commit -m "Update Prime Video case study" && git push
```

### Adding images to a case study

1. Save the image into `src/mocks/` as a `.jpg`, using a lowercase-hyphenated
   name — e.g. `src/mocks/creator-connections-overview.jpg`.
2. Reference it in the case study source with a token:
   ```html
   <figure class="cs-figure">
     <p class="cs-figure-label">Short label</p>
     <button class="cs-shot" type="button">
       <img src="{{IMG:creator-connections-overview}}" alt="Describe what the screen shows and what content decision it demonstrates.">
     </button>
     <figcaption>Optional caption explaining the reasoning.</figcaption>
   </figure>
   ```
3. Rebuild. The build fails loudly if a token has no matching file, so a typo
   can't reach the published site.

   Note there is deliberately **no `aria-label` on the button**. A label there
   would override the image's `alt` for screen reader users, and the `alt` is
   where the substance is — so write a real description in `alt` and leave the
   button unlabelled.

Keep mocks at roughly 1200–1400px wide, JPEG quality ~80. Base64 encoding
inflates them about 1.37×, so a 100 KB image adds ~137 KB to the page.

### Finishing Creator Connections and Ads Agent

`src/case-studies/creator-connections.html` and `ads-agent.html` are placeholders.
Their pages are already live so the links and navigation work. To finish one,
replace the file's contents using `src/case-studies/brand-store-quality.html` as
the pattern — it's the simplest of the three complete ones — then rebuild.

The reusable pieces are:

| Class | What it's for |
|-------|---------------|
| `cs-head` | The black title card: eyebrow, `h1`, lede, and the `cs-facts` list |
| `cs-block` | One section, with a small caps `h2` label |
| `cs-emph` | The large opening statement of a section |
| `cs-split` | Mock on the left, `cs-rationale` reasoning on the right |
| `cs-pair` | Two or three mocks side by side |
| `cs-list` | Role / goals / impact bullets |
| `cs-metrics` | Large numbers with captions |
| `cs-ba-label--before` / `--after` | Before-and-after labels |
| `cs-initiative` | A divider for a case study covering two separate efforts |

---

## Commands

```bash
# 0. One-time settings (each writes several files at once)
node tools/set-contact.mjs you@example.com
node tools/set-site-url.mjs https://julietersigni.github.io

# 1. Encrypt the case studies and regenerate the résumé data
node tools/build.mjs

# 2. Prove the published pages really are encrypted and nothing leaked
node tools/verify.mjs

# 3. Build dist/ — the only folder that should ever be uploaded
node tools/package.mjs

# Preview locally — see the note below about file://
python3 -m http.server 8000
open http://localhost:8000
```

**Run `verify.mjs` every time, not just when something feels wrong.** It decrypts
each published page and compares the result, which is the only check that can
prove encryption actually happened. `build.mjs` makes the same assertion
internally, so a silent failure would have to defeat both — but treat a clean
`verify` run as the thing that says a build is safe to publish.

`package.mjs` copies an explicit allowlist into `dist/` and aborts if anything
from `src/` or `tools/` slipped in. Upload `dist/`, never the project root — see
`GITHUB-SETUP.md`.

It also refuses to build while the contact email is still a placeholder, and warns
(without blocking) while interim copy is still in place. `--allow-placeholders`
overrides both if you mean to publish anyway.

### Always preview over `http://localhost`, not by double-clicking

The decryption uses the Web Crypto API, which browsers only expose in a secure
context. Chrome and Firefox treat `file://` as secure; **Safari does not.** If you
open the file directly in Safari, the case studies will refuse to decrypt and it
will look broken. Over `http://localhost:8000` everything works.

---

## Structure

```
.
├── index.html              Home — intro, featured work, access explainer
├── work.html               Work index, all five case studies
├── about.html              About + How I Work
├── contact.html            Email, LinkedIn, résumé download
├── 404.html
│
├── main.css                Design system + public pages
├── case-study.css          Password gate + long-form case study layout
├── main.js                 Nav, theme, reveal, résumé download
├── case-study.js           AES-GCM decryption in the browser
│
├── case-studies/           GENERATED — ciphertext only, do not edit
│   ├── creator-connections.html
│   ├── ads-agent.html
│   ├── prime-video.html
│   ├── brand-store-quality.html
│   └── click-to-pay.html
│
├── assets/
│   ├── img/julie-tersigni.jpg
│   └── resume-data.js      GENERATED by build.mjs
│
├── src/                    GITIGNORED — plaintext sources + original mocks
│   ├── case-studies/*.html
│   ├── mocks/*.jpg
│   └── img/
│
├── tools/
│   ├── build.mjs           Encrypt src/ → case-studies/
│   ├── verify.mjs          Decrypt the output again and prove it
│   ├── package.mjs         Build dist/ with only publishable files
│   ├── set-contact.mjs     Set the contact email everywhere at once
│   ├── set-site-url.mjs    Set the public URL (and CNAME, if a domain)
│   ├── template.html       The shell each case study is wrapped in
│   └── .password           GITIGNORED
│
├── dist/                   GENERATED, GITIGNORED — upload this, nothing else
│
├── robots.txt              Public pages indexable, case studies excluded
├── sitemap.xml
├── GITHUB-SETUP.md         Hosting and custom domain, step by step
└── README.md
```

---

## Design notes

- **Typography** is from your deck: **Staatliches** for display and **Work Sans**
  for body, both free from Google Fonts.
- **Strictly monochrome.** No accent colour anywhere — hierarchy comes from scale,
  weight, and space, which is what made the deck read as editorial.
- **Light by default, dark on request.** Long-form case studies read better on a
  light background, so that's the default; the toggle in the navigation inverts
  the whole site to the deck's black-and-white look, and the choice is remembered.
  It also follows the visitor's system preference on first visit.
- **The black slide is preserved** where it earns its keep: every case study
  opens on an inverted title card, and each page has at least one full-bleed
  black band.
- **The work index carries no imagery** — deliberately. Every mock is inside an
  encrypted page, so a public thumbnail grid would leak exactly what the
  encryption protects. The index is typographic instead.
- **Accessibility:** semantic landmarks, skip links, visible focus rings,
  keyboard-operable lightbox, `prefers-reduced-motion` respected, and alt text on
  every mock that describes the content design decision rather than just naming
  the screen.
- **Works without JavaScript** for everything except the case studies, which
  cannot work without it by definition. The gate explains that and offers an email
  fallback.

---

## What the protection does and doesn't cover

Worth being straight about the edges, so you can decide who to send the password to.

**It does:**

- Keep the case study text and every mock out of the page source entirely. There
  is no hidden `<div>`, and no image URL that can be fetched, hotlinked, or picked
  up by image search.
- Fail closed on a wrong password. GCM authentication means a near-miss produces
  nothing at all, not a partial render.
- Resist offline guessing reasonably well. PBKDF2 at 250,000 iterations makes each
  attempt cost real time, so the password's own strength is what matters — the one
  I generated is four random words and is fine.

**It doesn't:**

- Stop someone who has the password from saving, screenshotting, or forwarding
  what they read. Nothing can. The confidentiality notice at the top of each case
  study sets the expectation; the password limits who gets that far.
- Hide the password from the browser it was typed into. After a successful unlock
  it's kept in `sessionStorage` (key `jt-cs-pw`) so moving between case studies
  doesn't re-prompt. It's per-tab and cleared when the tab closes, and the site
  loads no third-party JavaScript — but on a shared or kiosk machine it is
  readable in developer tools until that tab is closed. If you'd rather trade the
  convenience for that, say so and I'll make it re-prompt per page.
- Protect anything once `src/` is public. That folder is the only readable copy of
  your content and the full-resolution mocks. It's gitignored, `verify.mjs` checks
  that on every run, and `package.mjs` refuses to build a bundle containing it —
  but don't hand it to anyone or upload it anywhere.

Rotating the password is cheap: change `tools/.password`, rerun the three
commands, push. Anyone holding the old one is locked out immediately, because the
ciphertext itself changes.

---

## Browser support

Current Safari, Chrome, Firefox, and Edge on desktop and mobile. The decryption
needs `window.crypto.subtle`, which means the site must be served over `https://`
or `http://localhost` — GitHub Pages gives you HTTPS automatically.
