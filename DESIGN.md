# The Morning Edit: design system

Personal editorial morning newsletter for Ariel. Approved Rosé Ribbons direction from the October 23 design preview: warm cream, blush gradients, burgundy sections, scalloped edges, striped paper frames and real photographs. Native HTML/CSS/JS; preserve all content and durable behavior.

## Approved composition and tokens

- Cream paper #fff4ea; primary text #49202e; muted #79545f; burgundy #7d2645; blush #edc2d0.
- Cormorant Garamond italic publication headings and DM Sans body/data/controls, self-hosted. Header centered above one wide aesthetic seasonal photograph and a discreet source credit.
- Reading width 1120px, fluid full-width colored sections; 20px mobile gutters. Blush agenda/weather panel, compact reminders, burgundy dated-event rows, striped frame around cream flexible-idea panels, burgundy finance, cream packages.
- Event rows show photo and complete details side by side on desktop; mobile stacks them. Ideas have one large feature and a two-column editorial list, stacked on mobile. All twenty items per section are visible without horizontal swiping or pagination.
- The changed backgrounds and scallops are explicitly approved; text remains on calm solid surfaces. A small reusable ribbon drawing adds detail without daily generated imagery. Header photography is curated independently of recommendation cards; historical editions retain their original artwork.
- Squared paper panels and buttons; round heart controls. Touch controls at least 44px on phones. No scroll hijacking or animations required to read content.

## Interaction & motion

Native dialog focus trapping and Escape, visible keyboard focus, skip link, semantic buttons, live status, meaningful empty and failure states. Hearts save to encrypted private GitHub state after connection; show success only after acknowledgement. Data is escaped before entering markup; external links allow HTTPS only. A single Three.js gold heart is decorative and isolated, pauses when offscreen/hidden, and becomes static with reduced motion. The main page remains usable when WebGL fails. Modest entry fade; no scroll hijacking, looping ticker, or custom cursor.

## Content

No invented weather, meetings, reminders, or event dates. The issue date is always visible. Article publication dates are distinguished from event dates. Generated artwork is atmosphere, never documentary evidence. Personal data belongs in ignored configuration and protected deployment. Keep setup instructions in settings rather than in the reading flow.

## Content density

Keep full details directly on the page: event dates/cost/neighborhood/source; free and paid undated ideas; all finance facts; package status/links/update times; calendar checks; reminders. Keep Past editions beside About your edit. Hearts, completions, package choices and opened links retain their encrypted cross-device behavior and stable IDs.

## Site identity and link previews

Browser tab icons (SVG, ICO, and PNG), the Apple touch icon, and the 512px sharing icon are copied unchanged from `ArielOlson/arielolson.github.io/docs/assets/icons`. The newsletter has its own title, description, canonical URL, and scoped web manifest. Open Graph and Twitter summary cards use the square monogram icon with absolute public URLs so previews work outside the browser. Keep these tags in the static HTML head so sharing services can read them without running JavaScript.

## Private edition

Production opens on a compact pink password screen using the existing serif and monogram. No personal content is present before successful decryption. Keep Apple Passwords autofill compatible, provide a Lock button, and lock after 15 minutes of inactivity or a reload. Do not call this native passkey authentication. The public local-development preview remains bound to loopback only.


## Edition photography (Rosé Ribbons, October 23, 2026)

Ariel approved one aesthetic seasonal photograph in the header on October 26, replacing the two recommendation highlights. Use real NYC scenery, seasonal details or an atmospheric venue photograph; no AI images, flyers, event headlines or recommendation captions at the top. Curate `config/photography.json` with `photos` entries containing `day` (first selected day), `availableThrough` (last seasonally appropriate day), `src`, `url` (photo credit source), `alt`, `source` and the actual `checkedAt`. Keep this public catalog free of personal information. Refresh selects the latest eligible photo independently of recommendations and stores it as `brief.photography` with mode `atmosphere`. Choose a new appropriate seasonal scene during each daily refresh, and never change its check time without verification. If a new photo cannot be verified, retain an eligible prior scene honestly with its original selection day. Choose photography independently of the event and idea cards; never reuse their images for the header, including resized variants. Prefer a softly lit, well-composed landscape photo with a clear seasonal atmosphere, not an event installation or promotional image. Record its native width and height. Display the full original composition with responsive width and automatic height, never a forced-height banner crop. Inspect the complete photo and its actual phone and desktop rendering before publication. Keep a discreet photographer/source credit. Verify it loads on phone and desktop; never substitute event highlights or generated art on failure. Older encrypted editions retain their original photos or artwork. Preserve all existing assets and manifest entries. `docs/artwork.md` describes the selection rules. The approved page uses burgundy event rows, a striped frame around cream idea panels, blush gradients, scalloped borders and serif headings; all 20 events and 20 ideas remain available without horizontal swiping. Preserve all content, durable user state and recommendation identity/cooldown rules.


## Twenty events and twenty flexible ideas (October 8, 2026)

Prepare 20 dated NYC events and 20 flexible free-time ideas daily. Ideas have no assigned date or time; dated events retain their actual schedule. Each idea requires a verified `costType` of `free` or `paid`. Aim for ten of each and require at least eight of each; a shortage blocks publication. Free means no required admission or purchase for the core activity; disclose optional food and transit costs. Mix walks, BYO picnics, free galleries, coffee, dinners, comedy and other activities. Do not count occasional free admission windows as generally free. Keep six to eight broader discoveries in the twenty dated events and at most two sample sales. Existing seven-day cooldown, stable identities, exclusions, hearts, reminders and encrypted cross-device state remain mandatory. Read accessible relevant chats for user-confirmed visits, wishes and interests; assistant suggestions are not evidence of a preference, and inaccessible wishlist contents must not be invented.
