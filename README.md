# StudeSafe — landing page

Static marketing site for StudeSafe. This branch (`website`) is intentionally
separate from `main` — it holds only the site, not the product docs, so it
can be pointed at directly by a static host (Cloudflare Pages, GitHub Pages,
etc.) with no build step.

## Structure

```
index.html
assets/
  style.css
  script.js
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
- **No logo mark/favicon asset** — the header uses a plain text wordmark
  ("studesafe") and the favicon is a minimal inline SVG dot, both to stay
  consistent with the single-color, no-branding-color-on-copy rule the
  rest of the page follows. Swap in the real logo file if the brand mark
  should appear on the page itself.

## Design constraints this page follows

- One background color, one ink/text color, used everywhere.
- One font-family, one font-size (`0.98rem`), one line-height (`1.53`) —
  enforced structurally in `style.css` via a `font: inherit` reset on every
  element, rather than set per-element, so it can't drift as the page
  grows.
- No card borders/shadows/fills anywhere — grouped content (features,
  audiences, FAQ) is separated by spacing only.
- Buttons are solid ink-colored with background-colored text — no other
  button style exists on the page.
- Mobile nav is a hamburger that becomes a full-screen overlay with all
  links centered both axes; the hamburger icon morphs into a × that closes
  it (`assets/script.js`).
