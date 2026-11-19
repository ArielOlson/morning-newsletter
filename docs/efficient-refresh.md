# Efficient daily refresh

AGENTS.md contains the current requirements. This runbook changes execution, not coverage, privacy, editorial standards or publication gates. The daily agent still needs authorized connector tools, web research and visual inspection; Node scripts do not independently access Gmail, Calendar or chats. Keep all progress/evidence in ignored `.cache/` or private `config/*.local.json`. Never put credentials, raw messages, personal wishes or screenshots in source commits.

## Start and resume

1. Run `pnpm daily status`. Read the saved stage report instead of reconstructing the previous attempt. Use the current New York day; do not fabricate missed editions. If yesterday is absent, the existing complete-history recovery must succeed before selection.
2. Refresh every configured calendar with its actual calendarId/inputIndex, all pages and the configured lookAheadDays. Deduplicate shared calendar IDs. Preserve actual per-calendar times and verify today's events/status. Keep the established snapshot schema in daily-refresh.md. If a connected scan fails after its allowed retry, retain its real check time and record the completed attempts with `pnpm daily reviewed calendarAttempts`; refresh may use the established public-feed fallback. This acknowledgement does not mark a failed scan fresh. Final source/status validation still applies.
3. Use the Gmail queue below. During its waits, research independent public sources and review the three relevant chats; do not start another Gmail request. Calendar and public-source work may overlap Gmail waits.
4. Run `pnpm research:plan` early. It reads current private choices and the seven-day encrypted history and reports event shortages, price/group availability, missing fields and evidence older than seven days. The inventory report is private. It is a planning aid, not proof that old facts remain true.
5. Replenish beyond the seven-day history, by the groups actually missing. Maintain a rolling surplus, rather than discovering forty cards at the last moment. Check official dates, costs, availability and photographs before selecting. Keep stable identities. `practicalDetails` holds verified opening restrictions/minimums without assigning a visit date; selection includes it in the displayed description. Never copy ambiguous legacy `timing` fields into it automatically.
6. Run `pnpm research:check` to catch failed source/image URLs before assembly. It uses two bounded public requests and reuses successful checks for unchanged candidates for at most one hour. It checks availability and content type; it does NOT verify facts, licenses, whether an image is promotional, or the composition. Inspect sources and photos yourself. A failed probe never advances a card's checkedAt.
7. Review user messages in things to do, restaurants and coffee, preserving private evidence and last reviewed message IDs. Process new messages; earlier assistant suggestions/saving claims are not user preferences. Read current durable exclusions. Only actual user wishes/visits and useful purchased-brand facts belong in the private profile.
8. Research three substantive finance stories from multiple publishers; disclose excerpt-only access. Curate and inspect an independent seasonal header photograph, including native dimensions, season/availability and actual check time. Preserve provenance and historical files; no forced crop, visible caption or generated illustration.

## Paced Gmail bridge

`pnpm package:queue next` returns exactly one claimed connector request or a waiting/review/completed status. Execute that request using the configured account's Gmail connector and then record its result. The queue itself never sends mail or calls a connector. `.cache/gmail-queue.local.json` is the private resumable journal. It retains reviewed immutable IDs, successful pages, actual completion times, pending work and global backoff across both accounts and midnight.

- A ready search includes account, query, id and optional pageToken. Use the query unchanged. The broad discovery query runs for every account; reference groups cover retained order/tracking references without a date cutoff. Newly learned references add searches in both accounts. Follow every page. A truncated result is rejected; investigate/split capped coverage without treating it as complete.
- A ready read contains at most ten new message IDs. Read the MIME content through the connector; do not store full bodies in the queue. Reuse previous reviewed immutable IDs. `awaiting-result` means a request was already claimed: record its actual result, not a second speculative call.
- Save a search result privately as `{"requestId":"claimed id","messageIds":["id"],"nextPageToken":"optional token"}`. Omit the token only when pagination is complete. Read results contain the exact requested messageIds. Run `pnpm package:queue record /absolute/private/result.json` immediately after the actual successful connector response; this records the real check time.
- On a connector error, record `{"requestId":"claimed id","error":"RATE_LIMIT_EXCEEDED","retryAfter":"optional seconds or HTTP date"}`. Other transient errors use their code. No success-shaped empty results. After throttling, both accounts stop for at least 60 seconds or longer Retry-After, then get one retry; remaining calls are at least 30 seconds apart. Normal spacing is at least 15 seconds after a completed call. The connector exposes no numeric quota: never probe for one.
- `pnpm package:queue status` shows progress without claiming work. For a genuinely interrupted request whose result cannot be recovered, `pnpm package:queue abandon` consumes its retry allowance and enforces a wait. Never abandon a known success instead of recording it. After a second failure the scan stays blocked and the prior complete snapshot remains untouched.
- Reconcile candidates with evidence: `{"accounts":[{"account":"configured account","reviews":[{"messageId":"id","shipmentIds":["stable parcel id"]}]}],"shipments":[/* minimal evidence-backed updates */]}`. An exclusion uses a specific `excludedReason` instead. Run `pnpm package:queue review /absolute/private/evidence.json`. Preserve item-level cancellations, source aliases, tracking/order identity, explicit email-supported return methods and scoped refund estimates. Do not infer manual Received/Return/Sent Back/Refunded choices or a bank refund from mail.
- Repeat `next` after reviews: new references may require more searches. `pnpm package:queue finalize` writes deliveries.local.json atomically ONLY after version-2 coverage passes for every configured account. It retains unresolved and delivered parcels. Finalizing twice is rejected so metadata enrichment cannot make an old scan look fresh. Metadata-only corrections use the established enrichment flow without advancing checkedAt.
- If a separate fresh scan is explicitly needed later the same day, `pnpm package:queue new-scan` starts it only after the prior scan is complete, retaining its journal/reviews and global pacing. Never use it to bypass a failed request or to restart unfinished work.
- Queue and runner lock files contain a process ID. If interrupted, verify that PID is no longer running before removing only its stale lock; never reset the queue or private state repository.

## Record actual review and assemble

After completing each real review, record its actual time with:

```
pnpm daily reviewed chatReview
pnpm daily reviewed financeReview
pnpm daily reviewed recommendationFacts
pnpm daily prepare
```

These acknowledgements do not perform the review. Never run them ahead of the corresponding work. Finance and recommendation reviews are bound to their input files; changes invalidate them. `prepare` requires today's complete Gmail scan and either today's calendar snapshots or a record of actual connector attempts followed by the existing fallback/status checks and the recorded editorial checks, refreshes public sources, checks source status and recommendation quotas, runs tests and builds only through `pnpm build`.

Inspect the prepared page on phone and desktop, including the complete header photograph, then:

```
pnpm daily reviewed headerPhoneAndDesktop
pnpm daily release
```

The visual review is bound to the actual header selection and built page. Release reuses unchanged, recent preparation stages, always runs the publisher's fresh private-state/remote/coverage guards, waits for the Pages workflow for the exact commit, and verifies live. A changed config, missing output, failed stage, expired refresh or new commit invalidates the appropriate checkpoint. Once daily release succeeds, no additional manual refresh/build/push/verify loop is needed.

The runner records timings and stage outcomes in `.cache/daily/YYYY-MM-DD/run.local.json`. Re-running resumes valid stages; it does not weaken the 90-minute publication freshness limit. The publisher still refuses unreconciled remote changes and force-pushes. The runner retries a recognized transient Pages artifact/hosting failure once per commit, preserving that retry allowance across resumes. Unknown failures, cancellations and a failed retry stop for inspection; retain prepared results and report an unresolved failure.

## Live verification and immutable history

The verifier uses two concurrent checks, a modest shared request interval, one transient retry and a shared cooldown. Gmail uses a separate, much slower queue. All live archives are decrypted and compared; every canonical plaintext endpoint must return a real 404; redirects, 403s and server errors never count as absence. Local assets and hosted photographs are hash-compared, external photographs must load as images. Current/index/page anchors are checked at both ends.

Successful individual checks can resume for at most 15 minutes, only when the prepared build, expected files, site and publication commit match. Completed runs are never reused as a new full verification. Changing a deployment or expiry discards the checkpoint. No old archive is skipped merely because it is old. The summary is `.cache/live-verification/result.local.json`.

Builds authenticate/decrypt existing archives before retaining identical encrypted payloads. New or changed content gets new random encryption; the password and encryption strength are unchanged. Corrupted files or a password mismatch still stop the build. This reduces needless Git changes without deleting history.

## Code-only maintenance

For an explicitly requested code/tooling improvement, `pnpm publish:newsletter --maintenance` can publish without pretending yesterday's edition is new. It compares the prepared current edition, archive membership, timestamps and every historical plaintext against the immutable commit recorded by the last successful live verification (not merely the last push). Any content change fails. It still reads private state, enforces privacy/remote guards, deploys to GitHub and requires exact-commit Pages success plus `pnpm verify:live`. This mode must never substitute for a daily refresh.

The Pages workflow names its uploaded artifact by workflow run and attempt, then waits briefly for that exact artifact to appear before deployment. Retrying cannot confuse an earlier upload with the new attempt. Only the prepared encrypted dist site is uploaded.

Numbered source conflict copies such as `scripts/example 2.mjs` are excluded from source fingerprints and publication. Preserve unexpected copies privately and reconcile the canonical file; never let them reintroduce old instructions or duplicate scripts.
