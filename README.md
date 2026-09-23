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
- **No custom font is loaded** — the page uses the OS's own system font
  stack (`-apple-system`, `Segoe UI`, etc.) so there's no external font
  request and no flash-of-unstyled-text. If a specific brand typeface is
  wanted later, swap the `--font` variable in `assets/style.css` and add
  one `<link>`/`@font-face` — everything else in the file already inherits
  from that one variable, so it's a one-line change.
- **Logo sizing was picked without a design tool** — `assets/images/logo.webp`
  is the real 2000×2000 brand mark, shown at `clamp(66px, 10.5vw, 90px)`
  tall in the header (`.logo img` in `style.css`, circular-cropped) and
  40px in the footer. Check it at actual deployed size and adjust
  `.logo img` / `.logo-footer img` if it ever looks off.
- **Two sections are placeholders by design, not oversights:**
  - `#product`'s mobile-app and web-app mockup frames (`.shot-frame` in
    `style.css`) are empty dashed boxes with a generic image icon — swap
    in real screenshots of the parent app and admin dashboard once they
    exist.
  - `#team` uses generic "Name" / "Role — placeholder" cards with a
    generic person-outline avatar (`.team-avatar`) — deliberately not
    filled with invented names or bios. Replace with real photos, names,
    and roles before this goes live.

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
  customers, FAQ) is separated by spacing only. The one deliberate
  exception is the dashed placeholder frames in `#product`/`#team` (see
  above) — those need a visible boundary to read as "swap this out",
  which is a different job than grouping real content.
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
Team (#team)           — placeholder member cards
Safety (#safety)       — unlinked, privacy/trust section
FAQ (#faq)
Contact (#contact)     — unlinked, in footer nav but not header nav
```

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
