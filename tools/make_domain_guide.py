#!/usr/bin/env python3
"""Build Julie's 'custom domain' guide as a .docx, matching the setup guide's design.

    python3 make_domain_guide.py OUT.docx

Kept alongside the project rather than in /tmp, since the earlier generator was
wiped and had to be rewritten.
"""
import re
import sys
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTE = RGBColor(0x5F, 0x5F, 0x5C)
DARK = RGBColor(0x33, 0x33, 0x33)
RULE = "D9D8D3"
SHADE = "F2F1EE"
BODY_FONT = "Calibri"
MONO_FONT = "Consolas"


# ---------------------------------------------------------------- helpers
def shade(par, fill):
    pPr = par._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    pPr.append(shd)


def border(par, edge="bottom", color=RULE, sz=6):
    pPr = par._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    el = OxmlElement("w:" + edge)
    el.set(qn("w:val"), "single")
    el.set(qn("w:sz"), str(sz))
    el.set(qn("w:space"), "4")
    el.set(qn("w:color"), color)
    bdr.append(el)
    pPr.append(bdr)


def hyperlink(par, url, text):
    r_id = par.part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    r = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    col = OxmlElement("w:color"); col.set(qn("w:val"), "1F4E79")
    u = OxmlElement("w:u"); u.set(qn("w:val"), "single")
    rPr.append(col); rPr.append(u); r.append(rPr)
    t = OxmlElement("w:t"); t.text = text; r.append(t)
    link.append(r)
    par._p.append(link)


TOKEN = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*]+?\*|<<[^>]+?>>)")


def rich(par, text, size=10.5, color=INK, bold=False, italic=False):
    """Render inline **bold**, *italic*, `mono` and <<url|label>> markup.

    Recurses into bold and italic so markup can nest — `**a `code` span**` used to
    match the bold alternation first and leave the backticks as literal text.
    """
    for chunk in TOKEN.split(text):
        if not chunk:
            continue
        if chunk.startswith("<<") and chunk.endswith(">>"):
            url, _, label = chunk[2:-2].partition("|")
            hyperlink(par, url, label or url)
            continue
        if chunk.startswith("**") and chunk.endswith("**"):
            rich(par, chunk[2:-2], size, color, bold=True, italic=italic)
            continue
        if chunk.startswith("*") and chunk.endswith("*"):
            rich(par, chunk[1:-1], size, color, bold=bold, italic=True)
            continue
        run = par.add_run()
        if chunk.startswith("`") and chunk.endswith("`"):
            run.text = chunk[1:-1]
            run.font.name = MONO_FONT
            run.font.size = Pt(size - 0.5)
        else:
            run.text = chunk
            run.font.name = BODY_FONT
            run.font.size = Pt(size)
        run.bold = bold
        run.italic = italic
        run.font.color.rgb = color


# ---------------------------------------------------------------- document
doc = Document()
s = doc.sections[0]
s.top_margin = s.bottom_margin = Inches(0.9)
s.left_margin = s.right_margin = Inches(1.0)

st = doc.styles["Normal"]
st.font.name = BODY_FONT
st.font.size = Pt(10.5)
st.font.color.rgb = INK
st.paragraph_format.space_after = Pt(8)
st.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
st.paragraph_format.line_spacing = 1.15

for name, size, before in (("Heading 1", 20, 0), ("Heading 2", 14, 20)):
    h = doc.styles[name]
    h.font.name = BODY_FONT
    h.font.size = Pt(size)
    h.font.bold = True
    h.font.color.rgb = INK
    h.paragraph_format.space_before = Pt(before)
    h.paragraph_format.space_after = Pt(6)


def H1(t):
    rich(doc.add_paragraph(style="Heading 1"), t, size=20)


def H2(t):
    p = doc.add_paragraph(style="Heading 2")
    rich(p, t, size=14)
    border(p, "bottom")


def P(t, after=8, size=10.5, color=INK):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    rich(p, t, size=size, color=color)


def BULLET(t):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(4)
    rich(p, t)


_n = [0]


def RESET():
    _n[0] = 0


def NUM(t):
    """Literal numbers: Word's List Number style shares one sequence per document."""
    _n[0] += 1
    p = doc.add_paragraph()
    f = p.paragraph_format
    f.left_indent = Inches(0.34)
    f.first_line_indent = Inches(-0.34)
    f.space_after = Pt(5)
    f.tab_stops.add_tab_stop(Inches(0.34))
    r = p.add_run("%d.\t" % _n[0])
    r.bold = True
    r.font.name = BODY_FONT
    r.font.size = Pt(10.5)
    r.font.color.rgb = INK
    rich(p, t)


def CODE(lines):
    p = doc.add_paragraph()
    f = p.paragraph_format
    f.left_indent = Inches(0.28)
    f.space_before = Pt(6)
    f.space_after = Pt(10)
    f.line_spacing = 1.0
    r = p.add_run("\n".join(lines))
    r.font.name = MONO_FONT
    r.font.size = Pt(10)
    shade(p, SHADE)


def CALLOUT(t):
    p = doc.add_paragraph()
    f = p.paragraph_format
    f.left_indent = Inches(0.18)
    f.right_indent = Inches(0.1)
    f.space_before = Pt(8)
    f.space_after = Pt(10)
    rich(p, t, size=10)
    shade(p, SHADE)
    border(p, "left", color="1A1A1A", sz=18)


def TABLE(rows, widths):
    t = doc.add_table(rows=0, cols=len(widths))
    t.style = "Table Grid"
    for r_i, row in enumerate(rows):
        cells = t.add_row().cells
        for c_i, val in enumerate(row):
            cells[c_i].width = Inches(widths[c_i])
            par = cells[c_i].paragraphs[0]
            par.paragraph_format.space_after = Pt(2)
            par.paragraph_format.space_before = Pt(2)
            run = par.add_run(val)
            run.font.name = MONO_FONT if (r_i > 0 and c_i > 0) else BODY_FONT
            run.font.size = Pt(9.5)
            run.bold = (r_i == 0)
            run.font.color.rgb = INK
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


# ---------------------------------------------------------------- content
H1("Using your own domain")
sub = doc.add_paragraph()
sub.paragraph_format.space_after = Pt(14)
border(sub, "bottom", color="1A1A1A", sz=8)
rich(sub, "Julie Tersigni — portfolio website  ·  Prepared by Joon Young",
     size=10, color=MUTE)

P("Your site is already live and finished at **julietersigni.github.io**. This is "
  "optional, and nothing breaks if you never do it — the GitHub address is permanent "
  "and keeps working either way.")
P("This sits outside the portfolio build — a custom domain is configured at your "
  "registrar and in your own GitHub settings, both of which only you can log into. "
  "I've written the steps out so you're not left guessing. They're short; the waiting "
  "is all DNS.")
P("**What it costs:** $10–20 a year to the registrar, and nothing else. Hosting stays "
  "free, and GitHub issues the security certificate for your domain at no charge.")

CALLOUT("**One piece of timing.** You're sending the link to Airbnb this week. Don't "
        "switch the domain the same day — while DNS is spreading, an address can be "
        "briefly unreachable, and that's not the moment for a recruiter to click. Send "
        "the GitHub address now; it's a real, permanent URL. Add the domain afterwards, "
        "and anyone who already has the old link is redirected automatically.")

H2("Step 1 — Buy the domain")
P("Any registrar works. These three are all straightforward and won't try to sell you "
  "hosting you already have:")
BULLET("**Cloudflare Registrar** — sells at wholesale cost with no markup or upsells. "
       "Cheapest over time.")
BULLET("**Namecheap** — simple interface, cheap first year, renews a little higher.")
BULLET("**Porkbun** — good pricing and a clear DNS editor.")
P("Two things while you're there: keep the registration in **your own name**, and turn "
  "on **WHOIS privacy** if it's offered free. All three include it, and it keeps your "
  "home address and phone number out of public domain records.")
P("Avoid anything that bundles “web hosting” or a “website builder” — you need neither, "
  "and they bury the DNS settings you actually want.")
P("Nothing else is needed at this stage. Once the domain is registered you can go "
  "straight to Step 2.")

H2("Step 2 — Add five records at the registrar")
P("Find the DNS settings, sometimes called DNS records, name servers, or advanced DNS. "
  "**Delete any existing A or CNAME records on `@` first** — registrars often add a "
  "placeholder pointing at a parking page, and it will fight with these.")
P("Four **A** records, all with the name `@`:", after=4)
TABLE([["Type", "Name", "Value"],
       ["A", "@", "185.199.108.153"],
       ["A", "@", "185.199.109.153"],
       ["A", "@", "185.199.110.153"],
       ["A", "@", "185.199.111.153"]], [0.9, 0.9, 3.4])
P("Four **AAAA** records, also on `@`. These are the IPv6 equivalents — some visitors' "
  "networks need them:", after=4)
TABLE([["Type", "Name", "Value"],
       ["AAAA", "@", "2606:50c0:8000::153"],
       ["AAAA", "@", "2606:50c0:8001::153"],
       ["AAAA", "@", "2606:50c0:8002::153"],
       ["AAAA", "@", "2606:50c0:8003::153"]], [0.9, 0.9, 3.4])
P("And one **CNAME**, so the www version works too:", after=4)
TABLE([["Type", "Name", "Value"],
       ["CNAME", "www", "julietersigni.github.io."]], [0.9, 0.9, 3.4])
CALLOUT("Two details that trip people up. The **trailing dot** on "
        "`julietersigni.github.io.` is deliberate — some registrars require it, others "
        "add it for you; either is fine. And where this guide says `@`, your registrar "
        "may want the field left **blank** or filled with your domain instead. All three "
        "mean the same thing: the bare domain.")
P("Leave TTL at whatever the registrar suggests.")

H2("Step 3 — Tell GitHub the domain is yours")
RESET()
NUM("Go to your repository, then **Settings → Pages**.")
NUM("Under **Custom domain**, type your domain without `https://` and without `www` — "
    "so `julietersigni.com` — and click **Save**.")
NUM("GitHub adds a small file called `CNAME` to the repository. That's expected. Leave "
    "it alone.")
NUM("GitHub now checks your DNS. This can take a few minutes or the better part of a "
    "day. If it says *“Domain's DNS record could not be verified”*, that is normal at "
    "first — wait and reload rather than changing anything.")
NUM("Once it verifies, tick **Enforce HTTPS**. If the box is greyed out, the "
    "certificate is still being issued; give it an hour.")

H2("Step 4 — Optional: the addresses written inside the site")
P("A few addresses are written into the site itself: the canonical tags that tell "
  "search engines which version is authoritative, the preview card that appears when a "
  "link is shared, the sitemap, and the robots file. They say `julietersigni.github.io`.")
P("**The site works perfectly whether or not you change these.** They affect how it "
  "ranks in search and how a shared link previews — neither matters much when you're "
  "sending the link to people directly.")
P("If you do want them updated, it's the same find-and-replace in six files in your "
  "repository: `julietersigni.github.io` becomes your new domain.")
BULLET("`index.html`, `work.html`, `about.html`, `contact.html`")
BULLET("`sitemap.xml` and `robots.txt`")
P("Each can be edited in the browser: open the file in your repository, click the "
  "pencil icon, use your browser's find, and commit. There is also a script in `tools/` "
  "that does all six at once, for anyone working from a local copy of the project.")

H2("When it's finished")
BULLET("`julietersigni.com` shows your site")
BULLET("`www.julietersigni.com` redirects to it")
BULLET("`julietersigni.github.io` keeps working and redirects, so old links never break")
BULLET("A padlock appears in the address bar, with no warnings")
BULLET("Your case studies still unlock exactly as they do now")

H2("If something looks wrong")
for title, body in [
    ("“Domain's DNS record could not be verified”",
     "Almost always just propagation. Wait an hour, reload the Pages settings page, and "
     "resist editing the records in the meantime — changing them restarts the clock."),
    ("“Domain does not resolve to the GitHub Pages server”",
     "A leftover record from the registrar's parking page is still on `@`. Delete any A "
     "or CNAME record there that isn't one of the nine above."),
    ("The www address works but the bare domain doesn't",
     "The A and AAAA records are missing, incomplete, or on the wrong name. All eight "
     "belong on `@`."),
    ("The site loads but there's no padlock",
     "The certificate hasn't been issued yet. **Enforce HTTPS** stays greyed out until "
     "it is, usually within the hour."),
    ("It worked, and then stopped months later",
     "Check the domain hasn't expired. It is by far the most common cause, and renewal "
     "emails are easy to miss. Turn on auto-renew."),
    ("Anything else",
     "GitHub's own guide to custom domains is thorough and kept up to date: "
     "<<https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site"
     "|docs.github.com/pages>>. For anything record-related, your registrar's support is "
     "usually fastest, since they can see your DNS panel while you're talking to them."),
]:
    P("**%s**" % title, after=2)
    P(body, after=9)

H2("If you'd rather not do it yourself")
P("Every registrar above has support who will add these records for you. It is one of "
  "the most common requests they handle, and they can see your DNS panel while you're "
  "on the phone, which makes them faster than anyone working from a screenshot.")
P("Whoever does it, the domain should be registered in **your** name and on your card, "
  "so it stays yours regardless.")

out = sys.argv[1] if len(sys.argv) > 1 else "domain.docx"
doc.save(out)
print("  ✓ %s" % out)
