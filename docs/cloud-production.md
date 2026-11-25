# Cloud production migration — paused

## Current state

On November 24, 2026, Ariel requested a return to normal local production. **Local Mac production is primary; cloud migration is paused and was never activated.** Preserve the local evening preparation schedule at **20:10** and morning production at **04:10 America/New_York**, including daylight-saving changes. The Mac must be awake, online and running Codex with the required connections. Aim for live-verified publication before **05:00**; do not guarantee the deadline or promise operation while the Mac sleeps or with its lid closed. All recommendation, coverage, privacy, history, durable-state and visual-review requirements remain in force.

Do not resume migration, start new cloud tasks or activate cloud schedules without a later explicit request from Ariel. Preserve existing cloud setup, credentials and repositories without deletion or rotation. The cloud-specific instructions below are inactive historical reference, not authorization to continue setup. Existing encrypted GitHub operations backups remain usable by the local workflow; keeping a backup does not activate cloud production.

Ariel's earlier cloud approval was given on November 19. The prior migration record reports that the published cloud environment passed read-only GitHub, runtime-secret, encrypted-current/index/archive, operations-bundle, durable-state and bounded Google connection checks. Separate read-only tests inside the original three preference chats matched their latest user messages; these are manual access tests only. Ariel has since expanded required review to every Lifestyle chat. Folder-wide discovery, all required current-chat reviews, encrypted handoff, sufficient public-source HTTP access, unattended environment-bound scheduling and a full cloud-only publication remain unverified. Do not repeat completed repository/password setup, or describe access tests as complete scans or publication.

## Repositories and credentials

- `ArielOlson/morning-newsletter`: safe source and encrypted published editions.
- `ArielOlson/morning-newsletter-state`: existing encrypted user choices; daily production reads it and never resets or replaces it.
- `ArielOlson/morning-newsletter-operations`: a separate **private** repository containing only encrypted operational working data. It is not the old private-archive repository.
- Never clone or import the old private-archive Git history into the public project.
- Use the cloud GitHub connection with access limited to these repositories. Verify authenticated shell/API access rather than assuming a connected app automatically supplies `gh` credentials. Never copy the Mac's `gh` token into cloud files, source or the website.
- Supply the unchanged newsletter password through the cloud personal secret facility as `MORNING_NEWSLETTER_PASSWORD`. Never put its value in a prompt, screenshot, source commit, public asset or operations bundle. Ariel approved secure cloud setup; do not rotate the password. Any separate UI authorization required by the provider must be completed.
- Publish the reusable cloud environment with safe source and installed dependencies only. Do not publish an environment snapshot containing restored private files or credentials. Restore private inputs at task runtime.

## Working-data transfer

`pnpm cloud:context pack` makes a private encrypted transfer in ignored `.cache/cloud-transfer/`. `pnpm cloud:context push --initialize` initializes the designated private operations repository. Subsequent `push` calls require the previously confirmed remote SHA and reject concurrent changes.

In a fresh cloud checkout, after secret and GitHub setup, enable Node 24's use of the managed environment proxy before running Node or pnpm commands:

```sh
export NODE_USE_ENV_PROXY=1
pnpm install --frozen-lockfile
pnpm cloud:context pull
```

Set `NODE_USE_ENV_PROXY=1` in every fresh cloud shell or command environment, including scheduled runs; a shell export only reaches that shell and its child processes. Node-based weather requests and `pnpm verify:live` need this initialization even when a separate HTTP client can connect successfully. Preserve the inherited proxy variables and CA trust settings; do not bypass the managed proxy or disable TLS verification. After changing the setting, retry with a fresh Node process.

The pull authenticates the encrypted bundle, rejects unknown paths, credentials, raw-mail fields and symlinks, and restores only absent or byte-identical files. Existing different private files stop restoration for reconciliation. It writes the existing secret to the ignored security file only at runtime; build tools still use that file. Do not pass the password on a command line.

The allowlist preserves private calendar configuration/snapshots, connection references, retained packages and coverage, research/preferences, personal reminders, finance, the Gmail queue, sealed research bundles, publication/verification pointers and the prepared current data. Actual source check times are preserved. It excludes credentials, raw messages, screenshots and daily stage-success claims. Published encrypted history is obtained from the current public repository and verified through the normal guards. The operations bundle does not substitute for a fresh scan or for verified publication history.

After an actual completed phase, run `pnpm cloud:context push` to preserve working data. A new cloud checkout must restore the latest bundle. A persistent working copy must reconcile a changed remote SHA before continuing; never reset it to overwrite another worker. Pending upload confirmation is recoverable without treating an unconfirmed write as saved.

## Cloud readiness gates (inactive reference)

Only after Ariel explicitly requests resuming migration, verify from the cloud itself, with no local computer or remote-Mac tools:

1. Node, pnpm, Git, authenticated GitHub access, internet research and a browser capable of actual mobile and desktop rendering.
2. Read-only access to both authorized Gmail accounts and every configured calendar. Resolve account bindings from the current connection configuration and actual cloud account listings. Do not silently substitute one account or stop at two calendars.
3. Complete discovery of every current Lifestyle chat using the private configured project ID, including active/archived pagination and future additions, plus review of actual recent user messages in every matched chat. A fixed three-chat list or exported old preference profile does not satisfy this requirement. In-chat reviews may be used only after actual source coverage and secure encrypted handoff have been verified. Missing chat access or incomplete coverage blocks readiness; Ariel has explicitly retained daily chat review.
4. Runtime secret access, authenticated decryption of every current/archive payload, and a fresh read of durable user choices.
5. A genuinely cloud-backed recurring scheduler with New York timezone. A local heartbeat targeting a cloud chat is not proof of unattended cloud scheduling.
6. An end-to-end cloud-only edition: complete sources, all content quotas/cooldowns, original-photo and phone/desktop reviews, `pnpm build`, exact-commit Pages success and full `pnpm verify:live`.

Even after a later explicit request to resume, do not activate the cloud schedule or replace local production until these gates have actual evidence. Passing old setup checks alone never authorizes resuming the paused migration. A push alone is not publication success.

## Historical cloud schedule proposal (inactive)

The November 19 proposal kept evening preparation around 20:10 New York and started morning cloud work around **02:10 New York**, allowing time for checks, research, retries, review and deployment before 05:00. This is not the active local schedule; local morning production remains at **04:10**. If Ariel later requests resuming cloud migration, reconfirm the cloud schedule, use supported New York timezone handling rather than a fixed UTC offset, and record the actual next run before activation.

The former 15-minute limit does not justify stopping useful overnight research. Reuse valid preparation and checkpoints; if preparation is missing, complete the ordinary full-refresh path while there is time. Never weaken evidence or publish an incomplete edition to meet the deadline. Avoid simultaneous publishers. Keep the last complete edition on a blocking failure and report the specific problem before the deadline when possible. Service failures and scheduler delays still prevent an absolute uptime guarantee.

The daily runner records `publicationDeadlineAt`, actual start/completion and whether live verification finished strictly before the deadline. It does not reset elapsed time or backdate completion. Continue to perform the final private-state read, current-source checks and complete history/live verification.
