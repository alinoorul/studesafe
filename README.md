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
  is the real 2000×2000 brand mark, shown at `clamp(44px, 7vw, 60px)` tall
  in the header (`.logo img` in `style.css`) and 40px in the footer. Those
  numbers are a reasonable starting guess for legibility at small sizes,
  not a pixel-measured decision — check it at actual deployed size and
  adjust `.logo img` / `.logo-footer img` if the wordmark inside the mark
  reads too small.

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
- No card borders/shadows/fills anywhere — grouped content (features,
  audiences, FAQ) is separated by spacing only.
- Buttons are flat, brand-blue with white text — no gradient/shadow, no
  other button style on the page.
- Mobile nav is a hamburger that becomes a full-screen overlay with all
  links centered both axes; the hamburger icon morphs into a × that closes
  it (`assets/script.js`).

## Brand palette

Sampled directly from `assets/images/logo.webp` by pixel frequency
(script isn't kept in the repo — it was a one-off `PIL` read of the raw
pixel data), then each hue was darkened just enough to clear WCAG AA
(4.5:1) for text/button use against the page background:

| Color | Raw (from logo) | Text/button-safe (used on page) | Role |
|---|---|---|---|
| Blue | `#0085ff` | `#0071d8` | Primary — links, buttons, trust/visibility content |
| Green | `#01c34b` | `#018433` | Secondary — confirmation/safety content (step numbers, the Safety section) |
| Coral | `#fe5353` | `#e50101` | Reserved — used in exactly one place (the "Notifications & escalation" heading), mirroring the logo itself, where red only appears in the small decorative wifi/dotted elements and never in the STUD/e/SAFE wordmark |

Copy text (paragraphs, list/FAQ content) intentionally stays the neutral
ink color regardless of section — only headings, links, buttons, and a
few small accent marks use the palette, so color reads as meaningful
(this thing is a link, this thing is a safety confirmation, this one
thing is an alert) rather than decorative.
