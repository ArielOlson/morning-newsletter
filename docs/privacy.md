# Newsletter privacy

## Required durable user state

Ariel requires ALL saved user changes to synchronize across devices and survive clearing browser data. This includes reminders, completion/undo marks, hearts, package Received/Return/Sent Back/Refunded stages and future features. Once due, reminders remain in every daily edition until explicitly completed; an end date does not dismiss them. Browser storage may cache or hold credentials, but is never the sole source of truth for a completed feature.

Use the encrypted state file in private `ArielOlson/morning-newsletter-state`, through the GitHub Contents API with a repository-limited fine-grained token entered by Ariel on each device. Never embed a token in public assets or copy the Mac's gh token into the site. Confirm each durable save before showing success; preserve drafts and old state on failures. Re-read the latest SHA and reapply only the intended mutation on conflicts. Keep deletion/undo tombstones so imports cannot resurrect older choices. Daily publication must never replace or reset this state repository. Verify clean-browser restoration and concurrent-device changes for state-related updates. Until Ariel connects a browser, legacy local data remains readable and new hosted saves require connection; do not claim sync is active on that device.


Only `/morning-newsletter/` is protected. The main website stays public. The hosted page receives an AES-256-GCM encrypted edition, authenticated with a key derived using PBKDF2-SHA256 (600,000 iterations). Each build uses a fresh random salt and nonce. The password is never embedded in HTML, JavaScript, GitHub settings, or the public repository.

This is password-based encryption, not a native passkey or server login. Save the newsletter password in Apple Passwords for `www.arielolson.com` with username `Ariel’s Morning Edit`. Supported devices can use Face ID or Touch ID to authorize autofill. Anyone who knows or guesses the password can read the newsletter. Public encrypted files allow offline guessing, so a short password provides less protection than a long random one; there is no server-side rate limit.

The password lives in ignored `config/security.local.json`, shaped as `{"password":"your chosen password"}`. Keep this file backed up privately. A missing password blocks builds and publishing; never substitute plaintext. The local setup page at `http://127.0.0.1:5173/__local/privacy-setup` can show or copy the configured password when `pnpm dev` is running. That page and its password endpoint are not in the production build. Local development is unencrypted and bound to the Mac's loopback interface; do not expose the development server or use a public tunnel.

Production holds the password and decrypted edition only in page memory. Reloading, leaving the page, using Lock, or 15 minutes of inactivity locks it. The browser may keep encrypted network responses; it receives no plaintext edition file. Hosted user state is encrypted with the newsletter password and stored in the separate private GitHub state repository. The device connection token is encrypted locally; clearing browser data removes that connection, while confirmed remote saves remain. Legacy browser data remains until imported, and clearing it before import loses those legacy items. Reminder form contents and decrypted reminder lists are cleared on lock. Received/completed/link marks use hashed identifiers and timestamps within encrypted shared state. Past editions and their index are encrypted with the newsletter password. Encryption does not protect against a compromised device, browser extension, or someone reading an already unlocked screen.

## Change the password

Password changes require a deliberate migration of the existing encrypted archive using the old password before rebuilding with the new one. Simply editing config/security.local.json will fail closed when the build cannot decrypt earlier editions. Back up the private configuration and archive first; migrate all archived editions and any saved browser cards before changing the password. After migration, run the normal refresh, test, build, publish and live-verification steps, then update Apple Passwords. Old encrypted editions can still be decrypted with their original password; changing the password cannot revoke downloaded copies. Never silently rotate Ariel's password during routine daily refreshes.

## Public history

The earlier public repository is preserved as the private `ArielOlson/morning-newsletter-private-archive`, with its Pages site disabled. A new public `ArielOlson/morning-newsletter` contains only safe source files and encrypted editions, without the old plaintext Git history. Do not copy commits or push branches from the archived checkout back into the public repository. Do not make the archive public. The publisher uses a fresh checkout; the old checkout and publication state remain in ignored `.cache/` storage for recovery.

Earlier visitors or third-party caches may retain previously public data; making the archive private cannot recall those copies. Google or Apple public calendar sharing is a separate access setting. Newsletter encryption does not make a publicly shared calendar private. Connected calendar access remains available as a fallback; changing calendar sharing must be handled separately.

## Daily checks

Build through `pnpm build` only. It excludes plaintext `public/data/` from Vite, encrypts the current edition, the archive index, and every historical edition under dist/data. The publisher verifies that decryption exactly matches the current local edition and rejects plaintext build data. `pnpm verify:live` checks the deployed encrypted payload locally without printing personal data, compares the complete encrypted archive too, verifies plaintext edition URLs return 404, and checks page assets. Use `pnpm test:privacy` to test the lock screen locally; set `PRIVACY_TEST_URL=https://www.arielolson.com/morning-newsletter/` to test the live site.


## Package choices

Packages have three sections: Incoming (Received or Return), Returns (Sent Back), and Refunds (Refunded). Confirmed choices move packages immediately and persist into later editions on connected devices. Received and Refunded hide finished packages; Show received & refunded provides undo. Returns remain until Sent Back; refunds remain until Refunded. These buttons record Ariel’s choices only; they do not initiate a merchant return, send mail, or confirm a bank refund.

The private GitHub state retains a minimal encrypted package snapshot with each choice, so returns and pending refunds survive after the email feed stops including the parcel. Preserve carrier/tracking identities and legacy received marks. Never infer a manual choice from an email status. Archive views retain the current choice for parcels present in that edition, without adding newer parcels to old editions. Storage is encrypted with the newsletter password and cleared from page memory on lock. Confirmed GitHub choices survive clearing browser data; reconnect the device to restore them. Legacy browser-only choices require import from their original browser. Password migrations must include this saved package ledger.
