# The Morning Edit 💛

## Required durable user state

Ariel requires ALL saved user changes to synchronize across devices and survive clearing browser data. This includes reminders, completion/undo marks, hearts, package Received/Return/Sent Back/Refunded stages and future features. Once due, reminders remain in every daily edition until explicitly completed; an end date does not dismiss them. Browser storage may cache or hold credentials, but is never the sole source of truth for a completed feature.

Use the encrypted state file in private `ArielOlson/morning-newsletter-state`, through the GitHub Contents API with a repository-limited fine-grained token entered by Ariel on each device. Never embed a token in public assets or copy the Mac's gh token into the site. Confirm each durable save before showing success; preserve drafts and old state on failures. Re-read the latest SHA and reapply only the intended mutation on conflicts. Keep deletion/undo tombstones so imports cannot resurrect older choices. Daily publication must never replace or reset this state repository. Verify clean-browser restoration and concurrent-device changes for state-related updates. Until Ariel connects a browser, legacy local data remains readable and new hosted saves require connection; do not claim sync is active on that device.


Ariel’s personal morning newsletter. Pink editorial styling, a custom NYC breakfast illustration, a tiny Three.js heart, and useful daily information. Plain HTML, CSS, and JavaScript, with Vite for bundling and a small Node script that prepares the edition.

## Start here

Use Node 24 and pnpm 11.19.0 (both are pinned for GitHub).

```sh
pnpm install
pnpm refresh
pnpm dev
```

Open the address printed by the server, normally http://127.0.0.1:5173. Keep the server running while reading locally. `pnpm build` creates a portable static website in `dist/`; `pnpm preview` previews that build. The local editor is available with `pnpm dev`, not the read-only production preview.

## Password protection

The hosted newsletter opens with a password. Save it in Apple Passwords for www.arielolson.com to use Face ID or Touch ID autofill on supported devices. This is encrypted password access, not a native passkey login. The main website is unchanged.

The password is in ignored `config/security.local.json`; do not commit it. On the original Mac, open http://127.0.0.1:5173/__local/privacy-setup while the development server runs to view or copy it. A new checkout needs this private configuration before it can build. Never bypass encryption by invoking Vite directly. See [docs/privacy.md](docs/privacy.md) for security limits, password changes, and history protection.

## Connect Apple or Google Calendar

Add public calendar links to `config/calendar.local.json` (copy `calendar.example.json` on a new checkout):

```json
{
  "urls": ["webcal://your-apple-feed", "https://calendar.google.com/calendar/ical/your-calendar-id/public/basic.ics"],
  "lookAheadDays": 14,
  "includeDescriptions": false
}
```

Apple public `webcal://` links, Google public sharing links with `cid` or `src`, and direct HTTPS iCal feeds are supported. For Google, the public iCal address is under Settings → your calendar → Integrate calendar. A normal Google sharing link only works as a public feed if that calendar is publicly accessible.

The daily task reads both Google primary calendars plus the configured Work and Skating Lessons calendars. Complete fresh connected scans take precedence over public feeds, which may omit private events. Public links remain a fallback. Shared calendars are scanned once, and each configured calendar is labeled in the edition. Duplicate shared events are merged, and each calendar’s check time is visible. The page shows when the connected calendar was checked. A successful scan is valid for up to 26 hours; failed or outdated scans show availability warnings. Details of this fallback are in [docs/daily-refresh.md](docs/daily-refresh.md).

Multiple links, recurring events, cancellations, moved instances, all-day dates, and New York daylight saving are supported. The newsletter never edits your calendar. Today’s plans and the next three upcoming plans are visible on the main page; the full two-week view remains available.

Private calendar links and snapshots are ignored by Git and blocked by the development server. The prepared edition contains displayed plans and delivery updates. Production builds encrypt it before publication. Connection settings, the password, and raw snapshots stay local.

## Deliveries

The daily Codex task scans both configured Gmail accounts for shipping and package notices, merges updates by tracking number, and saves `config/deliveries.local.json`. Each package uses three compact rows: a bold merchant/item/status caption, qualification and tracking/email links, and the last update. Received hides it on connected devices in later editions; Show received & refunded provides undo. The same tracking number retains this choice even if the source email changes. Split shipments remain separate. Pickup notices and subscription renewals are identified explicitly. Statuses are email-derived unless a successful official carrier check is recorded. Carrier tracking pages may block automated access; no tracking API credentials are required.

No email is sent, marked read, archived, or changed. Pickup PINs, addresses, and full email bodies are excluded. Connection IDs and private snapshots live in ignored `config/*.local.json`. The page’s **Refresh edition** button refreshes public sources and reuses the latest connector scan; it does not initiate a new Gmail scan. The daily task performs that scan. Snapshots older than 26 hours are visibly marked stale.

## Add something to the newsletter

Use **Made for Ariel → Save across your devices → Connect this device** once per browser. Create a fine-grained GitHub token for **Only select repositories → morning-newsletter-state**, with **Contents: Read and write**; keep other permissions off. Save it privately in Apple Passwords and paste it into the site, never chat. The token is encrypted locally with the newsletter password. Each confirmed reminder, completion, heart, link mark and package choice is stored encrypted in the separate private GitHub repository. Connect another device with the same key and newsletter password to restore those choices. Clearing browser data removes that device's connection but does not delete confirmed GitHub saves. Reconnect to recover them. Renew an expired token in Settings; data stays intact.

Existing browser-only reminders, saved cards, completion marks and package choices are imported when that browser connects. Connect each old browser before clearing it: unimported local data cannot be recovered from GitHub. Reminders stay visible once due until marked complete. A failed save keeps the draft and reports a failure; there is no silent local-only fallback. The local Mac editor continues to write private configuration.

Alternatively, edit `config/events.json` for items you are comfortable committing, or `config/events.local.json` for private items. Both use this structure:

```json
{
  "events": [
    {
      "id": "birthday-dinner-october",
      "title": "Book birthday dinner",
      "startDate": "2026-10-05",
      "endDate": "2026-10-11",
      "remindDaysBefore": 7,
      "note": "Find somewhere cozy.",
      "category": "personal"
    }
  ]
}
```

Dates are `YYYY-MM-DD` in New York. `endDate` is inclusive; omit it for a one-day item. A week is a first and last date. `remindDaysBefore` defaults to 7. Reminders start appearing at their lead time and remain visible after their date until marked complete. Upcoming reminders also appear in the two-week view. IDs must be unique across event files. Optional `url` must be HTTPS. More examples are in `config/events.example.json`; examples are never loaded as real plans.

Tell Codex **“Add [X] to the newsletter for [date or week]”** in this project. `AGENTS.md` records how to save it to the same private config, so future editions pick it up.

## What refreshes

- **Weather:** Open-Meteo’s NYC daily and hourly forecast in Fahrenheit. Rain probability, umbrella advice, clothing context, UV, and useful daytime temperatures. Change location and threshold in `config/preferences.json`.
- **Calendar:** Today and the next 14 days from public Apple/Google feeds or the connected Google snapshot.
- **Reminders:** Date-aware entries in the events config files.
- **NYC sample sales:** Organizer-provided names and date ranges from 260 Sample Sale’s public NYC event feed. Expired and non-NYC events are excluded.
- **NYC discoveries:** Organizer-verified dated events, 260 Sample Sale dates, and MLB’s official Red Sox schedule for NYC venues. RSS feeds provide research leads but undated articles are not used to fill the twenty event slots.
- **Finance:** Three substantive stories from Bloomberg, Financial Times, The Wall Street Journal, CNBC, and BBC Business, selected for relevance and publisher/topic variety. The daily task writes concise factual paraphrases and visible takeaways in private config/finance.local.json. Roundup/listicle teasers are excluded; summaries disclose when only a public feed excerpt was available.
- **Deliveries:** Package status from the last successful connected Gmail scan, with direct tracking links.
- **Curated events:** `config/nyc-events.json` can hold events with independently verified dates, category, source, and URL. The local Codex schedule can research these. The standalone GitHub workflow refreshes structured feeds only; it does not run Codex research.

The NYC section shows twenty dated picks in a horizontal photo carousel. Every caption includes the event name, dates, cost, neighborhood, useful details, and source link. Favorite artists, Red Sox games in NYC, seasonal events, ordered-brand popups, and sample sales are prioritized. Photos come from organizers, with unavailable images labeled honestly. No category filters or extra click is required to read the details.

Weather failure preserves an earlier forecast only for the **same day**, visibly marked as earlier. Calendar failures never display an empty day as if it were confirmed free. Failed news sources do not retain old leads. Every edition carries a date and refresh time. An older edition displays an explicit notice. Source timeouts and retries are bounded, and edition writes are atomic. A config error preserves the previous edition.

Saved discoveries synchronize through private GitHub state after connection and can outlive an event; check the source before going.

## Daily automation and publication

The live site is **https://www.arielolson.com/morning-newsletter/**, deployed from **https://github.com/ArielOlson/morning-newsletter**.

The existing Codex task runs at **4:10 a.m. America/New_York**, adjusting for daylight saving and aiming to finish before 5 a.m. It scans the connected calendar and shipping emails, refreshes weather and finance feeds, prepares twenty verified NYC picks and season-aware personal ideas, builds, and pushes the finished edition to GitHub. See `docs/daily-refresh.md` for the runbook. The Mac must be awake, online, with Codex running and GitHub authenticated. This is a daily best-effort schedule, not continuous live tracking.

After preparing an edition:

```sh
pnpm refresh
pnpm test
pnpm build
pnpm publish:newsletter
```

The publishing script uses the existing `gh` login and a reusable clone at `.cache/publish-repo`. It pulls `main` with fast-forward only, copies an explicit list of source files and `dist/`, commits, and pushes without force. It rejects old or unbuilt editions and stops if the remote project changed since the last publication, so those changes can be reconciled. Publication settings are in `config/publishing.json`.

The active `.github/workflows/static.yml` deploys **only `dist/`** after a push to `main`. It does not regenerate the edition or overwrite connected-account data. Only encrypted editions and their archive index in `dist/data/` are committed so the website receives the full prepared edition behind a password. Private configs, connector IDs, raw email, the working `public/data/` copy, and test screenshots are excluded. Calendar and shipment information is available only after decrypting with the newsletter password.

Each scheduled run must wait for its Pages deployment and run `pnpm verify:live` to decrypt the live `data/brief.enc.json` locally and verify that it matches the prepared edition. The old plaintext endpoint must return 404. A failed push or failed live verification is reported; it is never counted as success. If the Mac misses a run, the website keeps its previous edition and shows its date. GitHub Pages can cache updates briefly.

## Verification

```sh
pnpm test
pnpm build
# With pnpm dev running and Google Chrome installed:
pnpm test:browser
pnpm test:features
pnpm test:privacy
# The requested Playwright CLI is also installed:
pnpm exec playwright-cli open http://127.0.0.1:5173/ --browser=chrome
```

Data tests cover DST, recurrences, excluded and moved instances, all-day dates, reminder windows, weather failures, feed freshness, and sale expiry. Browser tests cover desktop/mobile layout, NYC detail fields, finance and delivery sections, saving, reminder writes, setup dialogs, stale/failure states, and private-file/cross-origin protection. The browser test temporarily creates a reminder and restores the original private file and edition afterward. Run it against the local development server without concurrent editing or refreshes.

## Design & references

`DESIGN.md` records the visual system, based on the Taste workflow and the DESIGN.md approach. `docs/design-reference.png` is the image-first design reference; `public/assets/morning.png` is the original generated illustration, not a factual event photograph. Fonts are self-hosted. The tiny Three.js accent pauses outside the viewport and respects reduced motion; the page works without WebGL.

Requested references consulted:
- https://github.com/leonxlnx/taste-skill
- https://github.com/Leonxlnx/taste-skill/tree/main/skills/image-to-code-skill
- https://github.com/voltagent/awesome-design-md
- https://vercel.com/kb/guide/claude-managed-agent-vercel
- https://playwright.dev/agent-cli/installation

The Vercel managed-agent article informed the separation between background work, private credentials, and the reading interface. This build uses a simple scheduled Node pipeline; it does not require an Anthropic account, paid agent runtime, or AI API key.

Documentation for operational assumptions:
- https://open-meteo.com/en/docs
- https://github.com/jens-maus/node-ical
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://learn.chatgpt.com/docs/automations?surface=app

## Personal ideas

`config/interests.local.json` stores preferences grounded in user messages and order confirmations. `config/ideas.local.json` holds undated restaurant/activity ideas with stable IDs, source links, photo URLs, and optional `seasonStart`/`seasonEnd` as MM-DD. They stay private and appear only in the encrypted edition. Ideas do not assign a date or time. Legacy `planWeekend`, `preferredWeekday`, and `dateSpecific` entries are excluded. Practical opening restrictions remain in the details.

## Past editions and browser history

Past editions appears beside About your edit. Each date keeps the final prepared edition for that day; later builds on the same day update that date. The index and every historical edition are encrypted. Builds preserve earlier encrypted editions in dist and private local copies in .cache/editions. Current code can render older edition schemas.

Received packages, completed reminders/ideas, saved hearts and opened links synchronize through encrypted GitHub state. Past editions show current marks for their original content. Finished package choices support undo. Clearing browser data requires reconnection, not recreation of confirmed saves.


## Daily NYC variety

Keep twenty dated NYC picks, with no events repeated from the previous New York calendar day. Research at least twenty options not shown the previous day; compare stable IDs and canonical source URLs with the encrypted prior-day archive, never with an earlier refresh of the same day. Set `discovery: true` on six to eight verified cultural or other broader discoveries outside the requested priority categories, chosen with Ariel’s interests in mind; leave it false/absent for favorite artists, Red Sox games, seasonal events, purchased-brand popups and sample sales. This is an internal editorial marker, not a displayed category or a claim of a stated preference. Research a varied pool before refreshing. Keep IDs stable, including multi-day events, rather than renaming repeats. The selector enforces zero repeats and a maximum of eight discoveries and seeks six to eight discoveries among twenty picks. A shortage is recorded in `status.city` and `errors`; research additional verified options before publication rather than relaxing the repeat cap or inventing events.


## Twenty free-time ideas

Prepare twenty season-appropriate restaurant/activity ideas each day, prioritizing Ariel’s explicit wishes and filling the remaining slots with researched suggestions likely to suit her interests. Prefer activities available most days (theater, comedy, live music, museums, walks) for the suggestion slots. Mark assistant suggestions `suggested: true`; the selector labels them “Suggested for you.” Never turn a suggestion into a remembered personal wish. Keep a surplus of verified suggestions in ignored `config/ideas.local.json` so seasonal exclusions and the seven-day cooldown still leave twenty. Set `availableThrough` for a closing production; remove expired suggestions from consideration. Keep exact closures, performance schedules, costs/minimums and actual checkedAt dates honest. Preserve existing wish IDs and browser completion behavior. The twenty-card limit applies before browser-local completed items are hidden. Check `status.ideas` and replenish the pool if fewer than twenty qualify.

### Phone reminder troubleshooting

Refresh edition reloads the website and restores confirmed saves from private GitHub state. If a device loses its connection after clearing browser data, reconnect from Made for Ariel. Import old browser-only data before clearing its original browser. GitHub outages or expired keys preserve saved data and keep unsaved drafts visible. Run `node tests/sync-browser.mjs` for two-device and cleared-storage recovery in Chrome and WebKit; these are browser-engine tests, not physical iOS-device tests.


## Daily seasonal artwork

Generate a new seasonal NYC header illustration each day using the built-in image-generation tool. Follow [docs/artwork.md](docs/artwork.md) for the dated asset and manifest workflow, generation failures, and archive preservation. Keep the pink editorial style and the main subject legible in the mobile crop. Never overwrite old artwork or include personal data in prompts or images. Verify status.artwork after refresh and the matching current/archive artwork after publication.


## Package choices

Packages have three sections: Incoming (Received or Return), Returns (Sent Back), and Refunds (Refunded). Confirmed choices move packages immediately and persist into later editions on connected devices. Received and Refunded hide finished packages; Show received & refunded provides undo. Returns remain until Sent Back; refunds remain until Refunded. These buttons record Ariel’s choices only; they do not initiate a merchant return, send mail, or confirm a bank refund.

The private GitHub state retains a minimal encrypted package snapshot with each choice, so returns and pending refunds survive after the email feed stops including the parcel. Preserve carrier/tracking identities and legacy received marks. Never infer a manual choice from an email status. Archive views retain the current choice for parcels present in that edition, without adding newer parcels to old editions. Storage is encrypted with the newsletter password and cleared from page memory on lock. Confirmed GitHub choices survive clearing browser data; reconnect the device to restore them. Legacy browser-only choices require import from their original browser. Password migrations must include this saved package ledger.


## No consecutive-day repeats in either carousel

Both What’s happening in NYC and Ideas for your free time must exclude every item shown in the previous New York calendar day’s encrypted edition. Compare stable IDs and canonical URLs; changing titles, IDs or tracking parameters must not disguise a repeat. Same-day rebuilds still compare against yesterday, not an earlier build today. This applies to explicit wishes as well as assistant suggestions in the daily ideas carousel. Preserve hearts, saved items, completion marks, reminders and private durable state; rotation does not delete saved items or unfinished reminders. Keep at least 160 verified ideas plus a surplus for seasonal/calendar exclusions, research replacements, and require twenty eligible new ideas before publication. Never relax the no-repeat rule to fill a shortage.


## Stronger recommendation rules (October 7, 2026)

The seven-day cooldown supersedes earlier previous-day-only instructions. Both carousels must exclude items shown in EITHER section during the preceding seven New York calendar days, including every version published during each day. Read encrypted archives, compare stable IDs, canonical URLs and optional stable `recommendationKey` identities. Never change an identity to disguise a repeat. Same-day rebuilds still use preceding calendar days; keep the union of same-day exposures for tomorrow. A missing yesterday archive blocks selection rather than silently disabling rotation.

Read the current private encrypted user state before selection and again before publication. Honor durable completion marks and `recommendationExclusions` (including explicit inactive/undo values); daily jobs are read-only consumers of that repository. Use relevant chats to collect only user-confirmed visits, interests and value preferences, with source-chat evidence in the private profile. Other assistants' suggestions are not user wishes. Confirm a private GitHub write before reporting that a new preference or visited-place correction is saved. Never put those facts in tracked config or documentation.

Cap sample sales at TWO per edition, even when the feed or priorities contain many; zero is fine. Research twenty new dated events and twenty eligible free-time ideas with a varied mix and practical costs. Do not alternate two small pools: continuously replenish options beyond the seven-day history. Publication guards reject shortages, repeats, duplicates and excess sample sales. Preserve saved hearts, reminders, completions and archive access when cards rotate out.


## Twenty events and twenty flexible ideas (October 8, 2026)

Prepare 20 dated NYC events and 20 flexible free-time ideas daily. Ideas have no assigned date or time; dated events retain their actual schedule. Each idea requires a verified `costType` of `free` or `paid`. Aim for ten of each and require at least eight of each; a shortage blocks publication. Free means no required admission or purchase for the core activity; disclose optional food and transit costs. Mix walks, BYO picnics, free galleries, coffee, dinners, comedy and other activities. Do not count occasional free admission windows as generally free. Keep six to eight broader discoveries in the twenty dated events and at most two sample sales. Existing seven-day cooldown, stable identities, exclusions, hearts, reminders and encrypted cross-device state remain mandatory. Read accessible relevant chats for user-confirmed visits, wishes and interests; assistant suggestions are not evidence of a preference, and inaccessible wishlist contents must not be invented.
