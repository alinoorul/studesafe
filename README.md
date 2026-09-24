# Studesafe — landing page

Static marketing site for Studesafe. This branch (`website`) is intentionally
separate from `main` — it holds only the site, not the product docs, so it
can be pointed at directly by a static host (Cloudflare Pages, GitHub Pages,
etc.) with no build step.

## Structure

```
index.html
assets/
  style.css
  script.js
  images/
    logo.webp
```

No framework, no build step, no dependencies — plain HTML/CSS/JS. Open
`index.html` directly in a browser, or serve the directory with any static
file server.

## Before this goes live

- **Contact email is a placeholder.** `mailto:hello@studesafe.app` in
  `index.html` (the "Email us" button) needs to be swapped for a real
  address.
- **Font is Manrope, loaded from Google Fonts** — `index.html` pulls
  weights 400/600/700 (the only ones actually used anywhere in
  `style.css`) via a `<link>` in `<head>`, with `display=swap` so text
  still renders in a fallback font instead of staying invisible while
  the webfont loads. `--font` in `assets/style.css` is `"Manrope",
  sans-serif` — the `sans-serif` fallback is a browser-required safety
  net for the rare case Manrope fails to load, not a second font in
  active use. If Manrope should ever be self-hosted instead of pulled
  from Google Fonts (fewer external requests, works offline), swap the
  `<link>` for local `@font-face` rules and the `--font` variable stays
  a one-line change either way.
- **Logo sizing was picked without a design tool** — `assets/images/logo.webp`
  is the real 2000×2000 brand mark, shown at `clamp(66px, 10.5vw, 90px)`
  tall in the header (`.logo img` in `style.css`, circular-cropped) and
  40px in the footer. Check it at actual deployed size and adjust
  `.logo img` / `.logo-footer img` if it ever looks off.
- **Several sections use the same placeholder image frame by design,
  not an oversight:** `#product`'s three mockups (mobile parent map,
  web admin dashboard, and a third for the "Missed checkpoint" step —
  see below), `#signal`'s product screenshot, each point in `#services`
  (a photo above every feature, full column width on widescreen), and
  each row in `#customers` (a photo beside the copy on widescreen,
  still shown — just stacked below — on mobile) all use `.shot-frame`
  (`style.css`): empty dashed boxes with a generic image icon. Swap in
  real screenshots as they exist; the frame variants (`--mobile`,
  `--web`, `--feature`, `--view`) only control aspect ratio/sizing, so
  swapping content never requires touching CSS.
- **`#product`'s third mockup is bottom-pinned to the copy column, not
  independently placed.** On desktop, `#product .product-layout` is the
  one place that overrides the shared `.product-layout` rule of pinning
  both columns to the top — it stretches instead, and the last
  `.shot-frame` in `.product-shots` gets `margin-top: auto`, so its
  bottom edge always lands exactly on the last step's text, however
  long the copy or however the images resize. This only works because
  the steps list (now 6 items) is the taller of the two columns —  if a
  future edit makes the three stacked images taller than the copy, the
  images become the row's height reference instead and the bottom
  no longer lines up; keep the third shot short (currently
  `--web`, not `--mobile`) or trim the copy back down if that happens.
- **Legal footer links are placeholders.** "Terms of Use", "Privacy
  Policy", and "Disclaimer" in the footer's Legal column are `href="#"`
  — real pages don't exist yet. Point them at the actual pages once
  they're written.
- **`#team` is real content**, not a placeholder — credits
  [Tech Studio.Art](https://techstudio.art) as the studio behind
  Studesafe, and the four member cards (name, role, one-line bio,
  initials avatar) were copied from techstudio.art's own team
  section: same structure, alignment, and sizing (`.team-avatar` at
  50% card width / 20% capped at 72px on mobile, 4→2→1 column grid),
  with colors mapped to Studesafe's own palette instead of importing
  Tech Studio.Art's green. If the roster changes, update the four
  `.team-member` blocks in `index.html` directly.

## Design constraints this page follows

- One background color (a neutral light grey, `#f6f6f6`), one ink/text
  color for copy, used everywhere.
- One font-family everywhere.
- **Copy text** (body paragraphs, list items, FAQ answers) is fixed at
  `0.98rem` font-size / `1.53` line-height throughout, and stays the single
  neutral ink color — it gets this for free by simply never being
  overridden, since that's `body`'s own font-size/line-height/color and
  copy elements just inherit it. **Headings, nav links, buttons, eyebrow
  labels, and footer text are not copy text** and have their own sizes
  (see the type-scale variables at the top of `style.css` — `--fs-h1`,
  `--fs-h2`, `--fs-nav`, etc.) and may use brand color.
- No card borders/shadows/fills anywhere — grouped content (services,
  customers, team, FAQ) is separated by spacing only. The one deliberate
  exception is `#product`'s dashed placeholder image frames (see above)
  — those need a visible boundary to read as "swap this out", which is
  a different job than grouping real content.
- Buttons are flat, brand-blue with white text, uppercase — no
  gradient/shadow, no other button style on the page.
- Nav links (header, mobile overlay, and footer) are uppercase, the same
  ink color as body copy, weight 600 — not brand-colored, so they read as
  navigation rather than emphasis.
- Mobile nav is a hamburger that becomes a full-screen overlay with all
  links centered both axes; the hamburger icon morphs into a × that closes
  it (`assets/script.js`).
- FAQ entries are native `<details>`/`<summary>`, with a down-chevron
  (`.faq-chevron`, blue, matches the button color) that flips to point up
  when open. `assets/script.js` intercepts the click to animate the
  answer's height open/closed (native `<details>` has no transition of
  its own — it snaps instantly) and respects
  `prefers-reduced-motion: reduce` by skipping straight to the end state.

## Page structure / nav mapping

Nav (header, mobile overlay, footer) is Product / Services / Customers /
Team / FAQ. A few existing sections don't have their own top-level nav
entry but are still on the page, in this order:

```
Hero (#top)
Idea (#idea)          — unlinked, "no device on the child" intro
Product (#product)    — the 5-step checkpoint chain + app mockup placeholders
Signal (#signal)      — unlinked, "how Studesafe knows" (see below)
Services (#services)  — the feature list (was "What's included")
Customers (#customers)— the audience breakdown (was "Who it's for")
Why (#why)             — unlinked, differentiation pitch
Team (#team)           — real member cards (Tech Studio.Art roster)
Safety (#safety)       — unlinked, privacy/trust section
FAQ (#faq)
Contact (#contact)     — unlinked, in footer nav but not header nav
```

The footer itself is a standard multi-column layout: logo (160px tall
at every width — centered on mobile, left-aligned from 720px up), three
link columns (Product / Company / Legal), and a copyright line
below a full-width divider — "© 2026 Studesafe." left-aligned, "All
Rights Reserved." right-aligned on the same row, both in the page's
ink color rather than dimmed. It duplicates the header/footer nav links
plus Contact under "Company", and adds the three Legal placeholders
described above.

## Brand palette

Sampled directly from `assets/images/logo.webp` by pixel frequency
(script isn't kept in the repo — it was a one-off `PIL` read of the raw
pixel data), then each hue was darkened just enough to clear WCAG AA
(4.5:1) for text/button use against the page background:

| Color | Raw (from logo) | Text/button-safe (used on page) | Role |
|---|---|---|---|
| Blue | `#0085ff` | `#0070d7` | Primary — links, buttons, trust/visibility content |
| Green | `#01c34b` | `#018333` | Secondary — confirmation/safety content (step numbers, the Safety section) |
| Coral | `#fe5353` | `#e40101` | Reserved — used only for alert/escalation content (the "Notifications & escalation" heading, and the "signal lost" half of the `#signal` section below), mirroring the logo itself, where red only appears in the small decorative wifi/dotted elements and never in the STUD/e/SAFE wordmark |

Copy text (paragraphs, list/FAQ content) intentionally stays the neutral
ink color regardless of section — only headings, links, buttons, and a
few small accent marks use the palette, so color reads as meaningful
(this thing is a link, this thing is a safety confirmation, this one
thing is an alert) rather than decorative.

List bullets follow the same logic: every `.plain-list` (Why, Safety,
and the escalation steps in `#signal`) uses a small CSS-drawn dot
(`.plain-list li::before`, `style.css`) — blue everywhere, except
`.escalation-steps` (the "Signal lost → escalating" list), which
overrides it to coral to match that list's alert content. It's a real
`border-radius: 50%` shape, not a Unicode bullet character, so its
size and vertical position stay exact regardless of font.

## The `#signal` section

The logo's own composition is the actual product logic, drawn out: green
wifi arcs at the top mean a signal (a checkpoint) is present; red arcs at
the bottom mean the signal is lost; the row of red dots under the
wordmark is the escalating chain of checks that follows. The `#signal`
section (between "Product" and "Services") makes this
explicit with two small hand-built SVG icons that echo the logo's own
arc shapes — green arcs pointing up for "signal received", coral arcs
mirrored downward for "signal lost" — plus a row of dots that pulse in
sequence under the lost-signal state, standing in for the actual named
escalation steps listed underneath (parent → transport coordinator →
school admin). The pulse animation respects `prefers-reduced-motion`.

Unlike every other section, `#signal`'s `<h2>` ("Product") sits above
`.product-layout` rather than inside `.product-copy` — the only way to
get the placeholder image's top edge to align with the "Green means
present..." line instead of the heading above it: both `.product-copy`
and `.product-shots` become plain grid siblings starting at the same
row top, so the (top-most) lede paragraph and the image top line up for
free. Moving the `<h2>` back inside `.product-copy` would break this.

Below that, `.signal-compare`'s two `.signal-state` columns
(`style.css`) are mirror images of each other on widescreen (≥720px):
`--ok` stays left-aligned as a normal block, `--lost` becomes a flex
column with `align-items: flex-end` so every child — icon, escalation
dots, heading, and paragraphs — sits flush against the column's right
edge. The escalation list (`.escalation-steps`, "Parent / Transport
coordinator / School administrator / Police") is the one exception: it
keeps its bullet dot on the left of its own text (`.plain-list`'s
default) and `align-items: stretch` so all four `<li>`s share one
width and their dots land in a single vertical column, instead of
following the rest of the column flush right. That column's horizontal
position — recentered under "Studesafe alerts the following humans in
order:" above it, rather than flush right like everything else — is
set by `assets/script.js` (`alignEscalationList`), not CSS: the two
lines' natural widths differ too much for a plain `align-self: center`
to land the dots anywhere near that line's actual center (it was tried
first and landed ~140px off). The script measures the dot's real
position (the `<li>`'s left edge plus its `0.15em` inset plus half the
6px dot) and the line's center on load, on resize, on the 720px
breakpoint crossing, and once webfonts finish loading (a late Manrope
swap can shift the line's width), then sets `margin-right` on the list
to close the gap. It lands within ~2-3px of exact from ~900px up; right
at the 720px edge the line above still wraps to two lines at that
width, which makes "the center of the line" ambiguous, and the script
just leaves the list flush right there rather than guessing.

"Signal received" and "Signal lost → escalating" land at
the same height via a single measured `margin-top: 2.65rem` on
`.signal-state--ok h3` — the `--lost` column has an extra
escalation-dots row between its icon and heading that `--ok` doesn't,
so without this the headings would be offset by exactly that row's
height. This value was measured directly (Playwright,
`getBoundingClientRect`), not hand-calculated, and holds at 0px
difference across the whole desktop range (720px–1440px+) since
nothing feeding it is viewport-relative; re-measure it the same way if
the escalation-dots row, its spacing, or the heading's own type-scale
variable (`--fs-h3`) ever changes.

Below 720px, both columns share one rule (`.signal-state`) that centers
everything instead — including the escalation list, which gets its own
`align-items: center` override so each `<li>` sizes to its own content
and centers as a unit, rather than inheriting `.plain-list`'s default
stretch-to-the-widest-item behavior (which would leave the dot+text
noticeably off-center, since the list's left-side dot padding isn't
mirrored on the right).
