# The Morning Edit: design system

Personal editorial morning newsletter for Ariel. Strawberry pink, butter-yellow hearts, paper surfaces, NYC breakfast illustration. Greenfield design. Taste dials: variance 6, motion 4, density 4. Native HTML/CSS/JS, an editorial aesthetic rather than a vendor design-system imitation.

## Image-first reference

`docs/design-reference.png` establishes the top-viewport composition: a small masthead, restrained tabbed navigation, left-aligned serif greeting, right-side breakfast illustration, flat agenda opposite a pink weather panel, then a reminder strip. Extracted hierarchy: headline roughly 2.4 times section type; small uppercase eyebrows; fine pink grouping rules; spacious reading area. The implemented greeting is deliberately smaller than the reference to fit the useful morning information on a laptop. All screenshot sample plans and weather were replaced with real data or truthful unconnected states.

## Tokens

- Background #fffaf7; raised paper #fffefd; primary text #3c292b; muted text #796365.
- Strawberry accent #a73d60; blush panel #f9e3e8; divider #eacbd2; reminder paper #fff2c7.
- Cormorant Garamond 500/600 for the masthead and publication headings. Its personal letter-like character fits an actual newsletter. Italic in the same family for warm notes.
- DM Sans 400/500/600 for dates, data, controls, and body text. Fonts bundled locally.
- Panels 5px corners, dialogs 10px, buttons 24px. This is an intentional hierarchy, not mixed random rounding.
- Horizontal content max 1240-1300px, gutters 48px desktop / 21px mobile. Agenda/weather ratio 1.45:1, single column below 768px. Event and idea rows use horizontally scrolling photo cards: roughly three cards per desktop viewport and one main card plus a preview on phones.
- One light paper theme: explicitly a print-emulating editorial publication, consistent in every section.

## Interaction & motion

Native dialog focus trapping and Escape, visible keyboard focus, skip link, semantic buttons, live status, meaningful empty and failure states. Hearts save to this browser. Data is escaped before entering markup; external links allow HTTPS only. A single Three.js gold heart is decorative and isolated, pauses when offscreen/hidden, and becomes static with reduced motion. The main page remains usable when WebGL fails. Modest entry fade; no scroll hijacking, looping ticker, or custom cursor.

## Content

No invented weather, meetings, reminders, or event dates. The issue date is always visible. Article publication dates are distinguished from event dates. Generated artwork is atmosphere, never documentary evidence. Personal data belongs in ignored configuration and protected deployment. Keep setup instructions in settings rather than in the reading flow.

## September 2026 reading-density revision

Compact the greeting and illustration so useful content starts sooner. Use ten photo-led NYC cards with name, dates, cost, neighborhood, details, and source links below each image; no category labels or filters. A separate matching carousel holds personal restaurant and activity ideas. Place the next three calendar plans inline, followed by finance headlines with descriptions and package status with visible dates. Keep the pink palette, artwork, serif headings, and small Three.js accent. Reduce decorative copy and avoid expand-to-read interactions. Clearly separate edition refresh time, connector scan time, and individual shipment status time. Packages use three semantic rows, wrapping naturally on phones. Keep Past editions beside About your edit, with an obvious return to the latest edition. Hearts, completed items, received packages, and opened links persist in the browser and are reflected when viewing past content.

## Site identity and link previews

Browser tab icons (SVG, ICO, and PNG), the Apple touch icon, and the 512px sharing icon are copied unchanged from `ArielOlson/arielolson.github.io/docs/assets/icons`. The newsletter has its own title, description, canonical URL, and scoped web manifest. Open Graph and Twitter summary cards use the square monogram icon with absolute public URLs so previews work outside the browser. Keep these tags in the static HTML head so sharing services can read them without running JavaScript.

## Private edition

Production opens on a compact pink password screen using the existing serif and monogram. No personal content is present before successful decryption. Keep Apple Passwords autofill compatible, provide a Lock button, and lock after 15 minutes of inactivity or a reload. Do not call this native passkey authentication. The public local-development preview remains bound to loopback only.


## Daily seasonal header

A fresh 3:2 painted NYC vignette follows the New York season each day, while keeping the existing pink and butter-yellow palette, compact header frame, and square mobile crop. Center the main still-life subjects. Every edition stores its own dated artwork path and descriptive alt text; old editions retain their original pictures. See docs/artwork.md.
