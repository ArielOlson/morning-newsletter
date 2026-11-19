# Cloud production migration

## Current state

Ariel approved cloud execution on November 19, 2026. The production requirement is a complete, live-verified edition before **05:00 America/New_York** each day, including daylight-saving changes. There is no 15-minute runtime requirement for cloud production. Keep all recommendation, coverage, privacy, history, durable-state and visual-review requirements.

This migration is **not activated**. The existing local morning and evening schedules remain the fallback until an actual cloud-only run passes. The first readiness check found that the cloud GitHub connection has no repository access configured. A browser sign-in and repository authorization are pending. Do not describe a runnable environment listing, a prepared encrypted transfer or a local test as proof of cloud publication.

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

In a fresh cloud checkout, after secret and GitHub setup:

```sh
pnpm install --frozen-lockfile
pnpm cloud:context pull
```

The pull authenticates the encrypted bundle, rejects unknown paths, credentials, raw-mail fields and symlinks, and restores only absent or byte-identical files. Existing different private files stop restoration for reconciliation. It writes the existing secret to the ignored security file only at runtime; build tools still use that file. Do not pass the password on a command line.

The allowlist preserves private calendar configuration/snapshots, connection references, retained packages and coverage, research/preferences, personal reminders, finance, the Gmail queue, sealed research bundles, publication/verification pointers and the prepared current data. Actual source check times are preserved. It excludes credentials, raw messages, screenshots and daily stage-success claims. Published encrypted history is obtained from the current public repository and verified through the normal guards. The operations bundle does not substitute for a fresh scan or for verified publication history.

After an actual completed phase, run `pnpm cloud:context push` to preserve working data. A new cloud checkout must restore the latest bundle. A persistent working copy must reconcile a changed remote SHA before continuing; never reset it to overwrite another worker. Pending upload confirmation is recoverable without treating an unconfirmed write as saved.

## Cloud readiness gates

Verify from the cloud itself, with no local computer or remote-Mac tools:

1. Node, pnpm, Git, authenticated GitHub access, internet research and a browser capable of actual mobile and desktop rendering.
2. Read-only access to both authorized Gmail accounts and every configured calendar. Resolve account bindings from the current connection configuration and actual cloud account listings. Do not silently substitute one account or stop at two calendars.
3. Access to recent user messages in things to do, restaurants and coffee. An exported old preference profile does not satisfy a fresh chat review. If that access is unavailable, report it and obtain an explicit supported replacement before claiming complete migration.
4. Runtime secret access, authenticated decryption of every current/archive payload, and a fresh read of durable user choices.
5. A genuinely cloud-backed recurring scheduler with New York timezone. A local heartbeat targeting a cloud chat is not proof of unattended cloud scheduling.
6. An end-to-end cloud-only edition: complete sources, all content quotas/cooldowns, original-photo and phone/desktop reviews, `pnpm build`, exact-commit Pages success and full `pnpm verify:live`.

Do not activate the cloud schedule or retire the local fallback until these gates have actual evidence. A push alone is not publication success.

## Planned schedule and deadline

Retain evening preparation around 20:10 New York. Start the morning cloud work around **02:10 New York**, leaving room for full source checks, additional research when required, bounded retries, review and deployment before 05:00. Use the scheduler's supported timezone handling; do not hardcode one UTC offset all year. Record the actual next scheduled run before activating.

The former 15-minute limit does not justify stopping useful overnight research. Reuse valid preparation and checkpoints; if preparation is missing, complete the ordinary full-refresh path while there is time. Never weaken evidence or publish an incomplete edition to meet the deadline. Avoid simultaneous publishers. Keep the last complete edition on a blocking failure and report the specific problem before the deadline when possible. Service failures and scheduler delays still prevent an absolute uptime guarantee.

The daily runner records `publicationDeadlineAt`, actual start/completion and whether live verification finished strictly before the deadline. It does not reset elapsed time or backdate completion. Continue to perform the final private-state read, current-source checks and complete history/live verification.
