# Getting your portfolio live

Everything on your side happens in the browser — nothing to install, no command line.

Four steps. Two are yours, one is Joon's, and the last has to be you, because publishing is an
owner-only setting. Budget about twenty minutes, most of it waiting on a confirmation email.

> **Steps 1 to 3 are already done** — the account exists, the repository is
> `julietersigni.github.io`, and Joon has collaborator access and has uploaded the site.
> They're kept below as a record of how it was set up. **Step 4 is the one still to do**, and
> it has to be you: publishing is an owner-only setting that collaborator access deliberately
> doesn't reach.

**What it costs: nothing.** No monthly fee, no trial, nothing to cancel.

---

## Where your site will live

GitHub stores your site's files and serves them to the internet — free, permanently, with
nothing to maintain and no bill.

Once Step 4 is done, your portfolio will be live at:

**https://julietersigni.github.io**

That is your finished site: a real, permanent, professional address you can put on a résumé or
send to a recruiter the same day, with HTTPS included — the padlock in the address bar.

If you'd rather have **julietersigni.com** one day, you can point it at this same site later.
That's optional, sits outside this build, and is the only part with a cost attached (around
$10–20 a year, paid to a domain registrar). Instructions are at the end.

---

## Before you start

You'll need:

- An email address you're happy to have tied to this account long-term
- Ten minutes of attention for Steps 1 and 2
- The case study password. **Joon is sending that in a separate message** — it deliberately
  isn't written down here, because this page becomes public along with your repository.

Nothing to buy, and nothing to install.

---

## Step 1 — Create your GitHub account  ✅ done

1. Go to **https://github.com/signup**
2. Enter your email, choose a password, pick a username.

   > **Choose the username carefully — it becomes your website address.**
   > `julietersigni` gives you `julietersigni.github.io`. Lowercase, no underscores, no
   > numbers if you can avoid them. This is the one decision here that's awkward to change
   > afterwards.

3. Verify your email. GitHub won't publish a site until you have.
4. The **free** plan is all you need. Skip any prompt to upgrade.

**Then turn on two-factor authentication:** your photo (top right) → **Settings** →
**Password and authentication** → **Two-factor authentication**. GitHub requires it for most
accounts now, and you don't want to be locked out of your own portfolio a year from now.

Send Joon your username once this is done.

---

## Step 2 — Create the repository  ✅ done

A repository is the folder GitHub publishes from.

1. Click the **+** in the top right → **New repository**.
2. **Repository name:** your username followed by `.github.io` — so exactly:

   ```
   julietersigni.github.io
   ```

   > **This name is a requirement, not a style choice.** It's what tells GitHub to publish at
   > the root of your address rather than in a subfolder. Any other name puts your site at
   > `julietersigni.github.io/something/`, and your error page would lose its styling. If you
   > chose a different username in Step 1, use that — the pattern is always
   > `julietersigni.github.io`.

3. **Visibility: Public.**

   This is the part that usually raises an eyebrow, so plainly: a public repository is safe
   here *because of how your case studies are built*. What gets uploaded is the encrypted
   version only. The readable copy of your writing and the original Amazon and Mastercard
   mockups stay on Joon's machine and are never part of what's published. Neither is the
   password.

   Free accounts can only publish from public repositories. A private one needs a paid plan
   (about $4/month) and isn't necessary — but say so if you'd prefer it and Joon will talk you
   through the trade-off.

4. Leave **"Add a README file"** unchecked.
5. Click **Create repository**.

---

## Step 3 — Give Joon access, so he can upload  ✅ done

The site is already built and waiting. Adding Joon as a collaborator lets him put the files in
for you — and make your revisions later without you having to do anything.

1. On your new repository, click **Settings** in the row of tabs across the top.
2. In the left sidebar: **Collaborators**.
3. Click **Add people**, enter **joonyoung82**, confirm.
4. Joon gets an email, accepts, uploads the site, and tells you when it's up.

**Collaborator access deliberately doesn't reach repository settings.** That's why Step 4 has
to be you: Joon can add and change files, but he cannot switch your website on, rename it, or
delete it. When the project is finished you can remove him from this same screen, and the
repository stays entirely yours.

> **If you'd rather upload the files yourself**, ask Joon for `dist.zip`. It contains only the
> publishable files, so there's nothing in it that could leak. Unzip it, then on the repository
> page click **uploading an existing file** and drag in the *contents* of the unzipped folder.
> One thing to avoid: don't upload the full project folder Joon works from — that one holds
> your plaintext case studies and the original mockups.

---

## Step 4 — Turn the website on  ⟵ this one is yours

Once Joon confirms the files are up. Five clicks, about two minutes.

1. On your repository, click **Settings**.
2. Left sidebar: **Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose **main**, leave the folder as **/ (root)**, click **Save**.
5. Wait two or three minutes, then reload. A green banner appears reading *"Your site is live
   at https://julietersigni.github.io/"*.

Click it. That's your portfolio.

---

## Step 5 — Check it over

Please work through this list and tell Joon about anything that looks off, however small.
Wording, spacing, an image you'd rather swap, a job title you'd phrase differently — all fair
game. That's what the revisions are for.

**The public pages**

- [ ] The homepage loads: your name, your photo, every section
- [ ] The sun/moon button at the top right switches the site to dark, and it *stays* dark
      after you reload
- [ ] The menu button works on your phone
- [ ] **Work** lists all five case studies, with Creator Connections and Ads Agent marked
      "In progress"
- [ ] **About** — your experience timeline, your education, and the three LinkedIn
      recommendations all read correctly, and you're happy having those quotes on the site
- [ ] **Contact** — the email address is yours, and the LinkedIn link goes to your profile
- [ ] A made-up address like `julietersigni.github.io/nope` shows a styled 404 page, not a
      bare GitHub one

**The case studies**

- [ ] Clicking a case study brings up a password screen
- [ ] The correct password unlocks it and the design mockups appear
- [ ] A wrong password shows an error and reveals nothing
- [ ] Clicking a mockup enlarges it, and Escape closes it
- [ ] Prime Video shows both initiatives, clearly separated
- [ ] Click to Pay's before-and-after pairs are the right way round
- [ ] Moving from one case study to the next doesn't ask for the password again

**Worth doing specifically**

- [ ] Open a case study in a browser you've never used it in — that's exactly what a recruiter
      sees
- [ ] Read a case study on your phone, since plenty of people will
- [ ] Right-click a case study → **View Page Source**, and search for a sentence you wrote.
      You should find nothing. That's the encryption working.

Three things are known, and waiting on you rather than broken: the **résumé download** stays
hidden until you send the PDF; the **About** page has one paragraph and the "How I work"
section still in Joon's placeholder wording, ready for your own; and the **contact email**
needs to be the address you actually want recruiters using.

---

## If something looks wrong

**"404 — There isn't a GitHub Pages site here"**
Step 4 hasn't been done yet, or hasn't finished. This is GitHub saying "no website is switched
on at this address" — not "your files are missing." Go back to Step 4.

**"Page not found" straight after finishing Step 4**
The first publish takes a few minutes. Wait five, then reload with **Cmd + Shift + R**.

**The site loads but looks like plain text on a white page**
The stylesheet isn't loading, which almost always means the repository name isn't exactly
`julietersigni.github.io`. Check under **Settings → General → Repository name**.

**A case study says JavaScript is needed**
Your case studies are decrypted in the browser, so JavaScript has to be enabled. It is by
default.

**A case study won't unlock**
Check the address starts with **https://** — the browser's decryption API is unavailable on
insecure origins. The password is case-sensitive. Stray spaces at either end are ignored,
so those aren't the cause.

**The "Download résumé" button is missing**
Expected until you send the PDF. It appears by itself once Joon adds the file.

**Anything else**
Send Joon a screenshot and the address you were on. Every version is saved, so anything can be
undone.

---

## A note on the password

Your case studies aren't merely hidden behind a prompt — they're encrypted with AES-256, the
same standard used for online banking.

In practice that means:

- The published files contain ciphertext only. Viewing the page source shows nothing
  readable, and switching JavaScript off reveals nothing either.
- The design mockups are encrypted *inside* those files. Nobody can guess an image address and
  download your unreleased Amazon or Mastercard screens directly — which is the mistake most
  "password protected" portfolios make.
- The password is never stored on the site and never sent anywhere. It's used to decrypt the
  content inside your visitor's own browser.

Three practical things:

1. Share the password by email or direct message, not anywhere public.
2. One password opens all five case studies. If you'd rather have a different one per case
   study — so you can send a specific project to a specific recruiter — just ask.
3. If you ever want it changed, ask. It takes a couple of minutes, and anyone holding the old
   one is locked out immediately.

Each case study also carries a short line at the top noting it's shared in confidence for
hiring evaluation. That sets the expectation; the password controls who gets that far.

---

## Making changes later

Send changes to Joon and he'll make them. If you'd like to edit your own text down the line, he
can show you — for the public pages it's a few clicks in the browser.

The case studies are different. Because they're encrypted, they have to be rebuilt rather than
edited in place — the same property that stops anyone else reading them. Send Joon the new
wording and he'll rebuild.

Two things to avoid in the repository: don't delete the folder called `tools`, and don't delete
anything inside `assets`. Your case studies and your résumé download are built from those.

Technical notes — how the site is built, how the encryption works, how to change the password,
how to finish Creator Connections and Ads Agent — are in **[README.md](README.md)**.

---

## Optional — pointing julietersigni.com at your site

**You can stop after Step 5.** `julietersigni.github.io` is a complete, permanent, professional
address, and plenty of senior designers use exactly that. This section is here for whenever you
decide you'd rather have your own domain on a résumé.

Nothing about the site needs rebuilding to switch. Joon runs one command and it repoints
itself; you handle the two steps below.

**1. Buy the domain.** Any registrar works — **Cloudflare Registrar** (sells at cost, no
upsells), **Namecheap**, or **Porkbun**. Keep it in your own name, and turn on free WHOIS
privacy so your home address stays out of public domain records. Avoid registrars that bundle
"web hosting" or a "website builder": you need neither, and they bury the settings you want.

**2. Add these DNS records** in the registrar's DNS panel, deleting any placeholder records
already sitting on `@`.

Four **A** records on `@`:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Four **AAAA** records on `@`:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

One **CNAME** record: host `www`, value `julietersigni.github.io.`

**3. Then** go to **Settings → Pages → Custom domain**, enter `julietersigni.com`, and Save.
Verification takes anywhere from a few minutes to 24 hours — wait rather than changing things.
Once it verifies, tick **Enforce HTTPS**.

Registration runs around $10–20 a year, paid by you directly to the registrar and kept in your
name. Configuring it is included in what Joon has already built; the annual fee is a
third-party cost.

---

## What you own when this is finished

- The **GitHub account**, with your email and your two-factor authentication
- The **repository** — remove Joon as a collaborator and he has no access at all
- The **website address**, free and permanent
- The **code**, which is plain HTML, CSS, and JavaScript with no paid services and nothing that
  can be switched off. If you ever want to leave GitHub, the whole site runs unchanged on
  Netlify, Cloudflare Pages, or any ordinary web host.
