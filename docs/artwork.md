# Header photography and archived artwork

## Edition photography (Rosé Ribbons, October 23, 2026)

Ariel approved Rosé Ribbons and real photography in place of daily AI header illustrations. Do not generate new header artwork. The refresh selects two distinct real organizer/venue photos from the current edition's recommendations, storing their URLs, alt text and source links in encrypted `brief.photography`. Favor season-appropriate photos when researching the daily pool. Verify both header photos load in the browser and keep image failures honest; no generated or unrelated stock fallback. Preserve all existing illustration assets and manifest entries for historical editions. `docs/artwork.md` describes this transition. The approved page uses burgundy event rows, a striped frame around cream idea panels, blush gradients, scalloped borders and serif headings; all 20 events and 20 ideas remain available without horizontal swiping. Preserve all content, durable user state and recommendation identity/cooldown rules.

## Legacy artwork runbook (historical reference only)

The instructions below document previous editions. Do not generate or require new artwork for current editions. Keep the files for archive integrity.

# Daily seasonal artwork

Generate a new decorative header illustration for each New York calendar day using the built-in image-generation tool and the imagegen skill. No API key or external hosting is needed. Match the warm pink, butter-yellow, hand-painted NYC style in DESIGN.md. Use public/assets/morning.png as a style reference, not a file to overwrite. Vary the scene and composition each day; changing only a filename or tint does not count as new art.

Follow New York seasons: spring March–May, summer June–August, autumn September–November, winter December–February. Refine the scene for the actual month: early-autumn apples and turning leaves, late-autumn golden branches, winter evergreens, spring blossoms, summer greenery. Holiday motifs should be timely, not used all season. Illustrations are atmosphere, never evidence of live weather, personal plans or actual events. Include no private data, names, readable text or access details.

Generate a landscape 3:2 image with its main subjects near the center so the existing square mobile crop works. Inspect it, then copy the final PNG into public/assets/artwork/YYYY-MM-DD-short-scene.png. Never overwrite an image already referenced by a past edition. Keep the original morning.png for older editions.

Append an entry to config/artwork.json under artworks: day, src (relative assets/artwork/ path), alt, width, height, season, generatedAt (actual generation time), prompt and tool. Prompt text must contain only decorative art direction, not personal context. Preserve previous entries and assets. For a deliberate same-day replacement, use a different filename and a later actual generatedAt.

Run pnpm refresh, inspect status.artwork and brief.artwork, then use the normal encrypted build/publication process. The selected artwork is stored with the encrypted edition, so opening a past edition restores its own image. Images themselves are nonprivate decorative public assets. Browser and live checks verify that current and archived artwork loads and that the deployed image bytes match the build.

If generation fails, retry a transient failure once. Keep the previous valid image with its original date/time; the refresh marks artwork stale or unavailable rather than pretending it was generated today. Publish the useful newsletter with that honest status and report the artwork failure. Do not use a paid API fallback without Ariel's authorization.
