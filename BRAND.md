# List Check brand system

## Purpose and voice

Help organizers text only the members who should get texts. The personality is calm, trustworthy, and plain-spoken. Say “people,” not “records”; give the next step; never blame the user; use sentence case.

## Color

| Token | Light value | Use and contrast |
|---|---|---|
| Brand teal | `#1f6f78` | Links and primary actions; 5.83:1 with white |
| Brand hover | `#164f55` | Hover actions; 9.20:1 with white |
| Brand tint | `#e6f2f2` | Quiet brand surfaces |
| Warm page / surface | `#f6f5f2` / `#ffffff` | Page and cards |
| Text / muted | `#1f2a2e` / `#55636a` | 13.48:1 / 5.70:1 on the warm page |
| Functional border | `#6f8588` | Upload boundary; 3.63:1 against its tinted surface |
| Decorative border | `#d8dedf` | Dividers only; never conveys state |
| Ready / tint | `#315a46` / `#e8f0e9` | 6.74:1 |
| Review / tint | `#71520b` / `#f5efd9` | 6.26:1 |
| Opted out / tint | `#55636a` / `#e8ebea` | 5.18:1 |
| Error / tint | `#8c3b32` / `#f5e7e4` | 6.26:1 |
| Zero-count / tint | `#55636a` / `#e8ebea` | 5.18:1 |

Dark mode uses page `#142022`, surface `#1d2b2e`, text `#e7eeee`, muted `#a9b8ba`, and brand teal `#7cc4c9`. Ready `#a7d6b7` on `#213a2d` is 7.58:1; review `#f0d483` on `#30302a` is 9.13:1; opted out and zero-count `#a9b8ba` on `#2b393c` is 5.85:1; error `#edaaa1` on `#332b2b` is 7.14:1. State meaning always includes an icon and words, not color alone.

Color values belong in CSS `:root` tokens. The browser’s theme-color metadata and standalone SVG/PNG assets repeat the relevant token values because they cannot read the page stylesheet.

## Type

Self-host Atkinson Hyperlegible through Fontsource, weights 400 and 700; do not request fonts from Google. See [LICENSES/Atkinson-Hyperlegible-OFL.txt](./LICENSES/Atkinson-Hyperlegible-OFL.txt). Use 16 / 20 / 25 / 31 / 39px, body line-height 1.5, heading line-height 1.2, and `-0.02em` tracking at 31px and above. Keep text measures within 65ch.

## Shape, space, and motion

Use only 8 / 16 / 24 / 32 / 48px spacing. Cards and upload zones use 12px corners, buttons and tiles 8px, and small badges 999px. Cards use one soft shadow; other surfaces have none.

Transitions are 150ms ease for color, background, and border only, inside `prefers-reduced-motion: no-preference`. Reduced-motion users get no animation.

## Icons and identity

Use Lucide inline SVGs only: 2px strokes at 20 or 24px, with decorative icons marked `aria-hidden="true"` and meaningful states paired with text. Lucide icons are MIT licensed; see [LICENSES/Lucide-MIT.txt](./LICENSES/Lucide-MIT.txt).

The mark is a check in a rounded square beside the bold `List Check` wordmark. Keep the mark at least 24px high with 8px clear space. Use the same mark in the favicon, touch icon, and social preview.

The link-preview image is `public/og-image.png`, sized 1200×630. Theme metadata repeats the light and dark brand colors for browser chrome.
