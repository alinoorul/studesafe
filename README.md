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
  not an oversight:** `#product`'s mobile-app and web-app mockups,
  `#signal`'s product screenshot, each point in `#services` (a photo
  above every feature, full column width on widescreen), and each row
  in `#customers` (a photo beside the copy on widescreen, still shown —
  just stacked below — on mobile) all use `.shot-frame` (`style.css`):
  empty dashed boxes with a generic image icon. Swap in real
  screenshots as they exist; the frame variants (`--mobile`, `--web`,
  `--feature`, `--view`) only control aspect ratio/sizing, so swapping
  content never requires touching CSS.
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

- One background color (a barely-tinted off-white, `#f7f9fd`), one ink/text
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

The footer itself is a standard multi-column layout: logo + one-line
tagline on the left, three link columns (Product / Company / Legal) on
the right, with a copyright bar below a full-width divider. It
duplicates the header/footer nav links plus Contact under "Company",
and adds the three Legal placeholders described above.

## Brand palette

Sampled directly from `assets/images/logo.webp` by pixel frequency
(script isn't kept in the repo — it was a one-off `PIL` read of the raw
pixel data), then each hue was darkened just enough to clear WCAG AA
(4.5:1) for text/button use against the page background:

| Color | Raw (from logo) | Text/button-safe (used on page) | Role |
|---|---|---|---|
| Blue | `#0085ff` | `#0071d8` | Primary — links, buttons, trust/visibility content |
| Green | `#01c34b` | `#018433` | Secondary — confirmation/safety content (step numbers, the Safety section) |
| Coral | `#fe5353` | `#e50101` | Reserved — used only for alert/escalation content (the "Notifications & escalation" heading, and the "signal lost" half of the `#signal` section below), mirroring the logo itself, where red only appears in the small decorative wifi/dotted elements and never in the STUD/e/SAFE wordmark |

Copy text (paragraphs, list/FAQ content) intentionally stays the neutral
ink color regardless of section — only headings, links, buttons, and a
few small accent marks use the palette, so color reads as meaningful
(this thing is a link, this thing is a safety confirmation, this one
thing is an alert) rather than decorative.

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
