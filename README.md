# The Morning Edit 💛

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

Ariel’s supplied Google link is saved locally. Its public feed returned events successfully on the latest refresh. The daily task reads both configured Google primary calendars, using their separate connected snapshots when public feeds are unavailable. Duplicate shared events are merged, and each calendar’s check time is visible. The page shows when the connected calendar was checked. A successful scan is valid for up to 26 hours; failed or outdated scans show availability warnings. Details of this fallback are in [docs/daily-refresh.md](docs/daily-refresh.md).

Multiple links, recurring events, cancellations, moved instances, all-day dates, and New York daylight saving are supported. The newsletter never edits your calendar. Today’s plans and the next three upcoming plans are visible on the main page; the full two-week view remains available.

Private calendar links and snapshots are ignored by Git and blocked by the development server. The prepared edition contains displayed plans and delivery updates. Production builds encrypt it before publication. Connection settings, the password, and raw snapshots stay local.

## Deliveries

The daily Codex task scans both configured Gmail accounts for shipping and package notices, merges updates by tracking number, and saves `config/deliveries.local.json`. Each package uses three compact rows: a bold merchant/item/status caption, qualification and tracking/email links, and the last update. Mark as received hides it in this browser in later editions; Show received provides undo. The same tracking number retains this choice even if the source email changes. Split shipments remain separate. Pickup notices and subscription renewals are identified explicitly. Statuses are email-derived unless a successful official carrier check is recorded. Carrier tracking pages may block automated access; no tracking API credentials are required.

No email is sent, marked read, archived, or changed. Pickup PINs, addresses, and full email bodies are excluded. Connection IDs and private snapshots live in ignored `config/*.local.json`. The page’s **Refresh edition** button refreshes public sources and reuses the latest connector scan; it does not initiate a new Gmail scan. The daily task performs that scan. Snapshots older than 26 hours are visibly marked stale.

## Add something to the newsletter

Use **Add a reminder** on the local page. It writes to `config/events.local.json` and refreshes the edition. On a hosted static site, add reminders through the config file instead; the page explains this when saving is unavailable.

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

Dates are `YYYY-MM-DD` in New York. `endDate` is inclusive; omit it for a one-day item. A week is a first and last date. `remindDaysBefore` defaults to 7. Expired reminders disappear automatically, while upcoming reminders appear in the two-week view. IDs must be unique across event files. Optional `url` must be HTTPS. More examples are in `config/events.example.json`; examples are never loaded as real plans.

Tell Codex **“Add [X] to the newsletter for [date or week]”** in this project. `AGENTS.md` records how to save it to the same private config, so future editions pick it up.

## What refreshes

- **Weather:** Open-Meteo’s NYC daily and hourly forecast in Fahrenheit. Rain probability, umbrella advice, clothing context, UV, and useful daytime temperatures. Change location and threshold in `config/preferences.json`.
- **Calendar:** Today and the next 14 days from public Apple/Google feeds or the connected Google snapshot.
- **Reminders:** Date-aware entries in the events config files.
- **NYC sample sales:** Organizer-provided names and date ranges from 260 Sample Sale’s public NYC event feed. Expired and non-NYC events are excluded.
- **NYC discoveries:** Organizer-verified dated events, 260 Sample Sale dates, and MLB’s official Red Sox schedule for NYC venues. RSS feeds provide research leads but undated articles are not used to fill the ten event slots.
- **Finance:** Three substantive stories from Bloomberg, Financial Times, The Wall Street Journal, CNBC, and BBC Business, selected for relevance and publisher/topic variety. The daily task writes concise factual paraphrases and visible takeaways in private config/finance.local.json. Roundup/listicle teasers are excluded; summaries disclose when only a public feed excerpt was available.
- **Deliveries:** Package status from the last successful connected Gmail scan, with direct tracking links.
- **Curated events:** `config/nyc-events.json` can hold events with independently verified dates, category, source, and URL. The local Codex schedule can research these. The standalone GitHub workflow refreshes structured feeds only; it does not run Codex research.

The NYC section shows ten dated picks in a horizontal photo carousel. Every caption includes the event name, dates, cost, neighborhood, useful details, and source link. Favorite artists, Red Sox games in NYC, seasonal events, ordered-brand popups, and sample sales are prioritized. Photos come from organizers, with unavailable images labeled honestly. No category filters or extra click is required to read the details.

Weather failure preserves an earlier forecast only for the **same day**, visibly marked as earlier. Calendar failures never display an empty day as if it were confirmed free. Failed news sources do not retain old leads. Every edition carries a date and refresh time. An older edition displays an explicit notice. Source timeouts and retries are bounded, and edition writes are atomic. A config error preserves the previous edition.

Saved discoveries live only in the current browser’s local storage. They do not sync between devices, and can outlive an event; check the source before going.

## Daily automation and publication

The live site is **https://www.arielolson.com/morning-newsletter/**, deployed from **https://github.com/ArielOlson/morning-newsletter**.

The existing Codex task runs at **4:10 a.m. America/New_York**, adjusting for daylight saving and aiming to finish before 5 a.m. It scans the connected calendar and shipping emails, refreshes weather and finance feeds, prepares ten verified NYC picks and season-aware personal ideas, builds, and pushes the finished edition to GitHub. See `docs/daily-refresh.md` for the runbook. The Mac must be awake, online, with Codex running and GitHub authenticated. This is a daily best-effort schedule, not continuous live tracking.

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

`config/interests.local.json` stores preferences grounded in user messages and order confirmations. `config/ideas.local.json` holds undated restaurant/activity ideas with stable IDs, source links, photo URLs, and optional `seasonStart`/`seasonEnd` as MM-DD. They stay private and appear only in the encrypted edition. A `planWeekend` idea gets a suggested weekend date on Tuesdays only when both calendars are fresh and show no plans on that day. `preferredWeekday: 7` keeps Sunday-specific outings on Sunday. Suggestions are never calendar bookings.

## Past editions and browser history

Past editions appears beside About your edit. Each date keeps the final prepared edition for that day; later builds on the same day update that date. The index and every historical edition are encrypted. Builds preserve earlier encrypted editions in dist and private local copies in .cache/editions. Current code can render older edition schemas.

Received packages, completed reminders/ideas, and opened links are remembered by hashed identifiers in this browser only. Reloads and new editions preserve these choices. Past editions retain their original content and display your current completion/received marks and hearts; they are not frozen snapshots of your clicking history. Show received allows undo; past editions allow undo of completed items. Clearing browser storage resets these choices, and they do not synchronize between devices. On the hosted site, saved card details are encrypted in browser storage.


## Daily NYC variety

Keep ten dated NYC picks, with at most three repeated from the previous New York calendar day. Research at least seven new options daily; compare stable IDs and canonical source URLs with the encrypted prior-day archive, never with an earlier refresh of the same day. Set `discovery: true` on three or four verified cultural or other broader discoveries outside the requested priority categories, chosen with Ariel’s interests in mind; leave it false/absent for favorite artists, Red Sox games, seasonal events, purchased-brand popups and sample sales. This is an internal editorial marker, not a displayed category or a claim of a stated preference. Research a varied pool before refreshing. Keep IDs stable, including multi-day events, rather than renaming repeats. The selector enforces a maximum of three repeats and four discoveries and seeks three or four discoveries among ten picks. A shortage is recorded in `status.city` and `errors`; research additional verified options before publication rather than relaxing the repeat cap or inventing events.
