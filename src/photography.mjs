// Header photos are selected from the edition itself, never invented or generated.
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; } };
export function selectHeaderPhotos(brief) {
  const events = brief.finds || [], ideas = brief.ideas || [];
  // A place to go and an outing to try; prefer explicit wishes, then editorial order.
  const candidates = [ideas.find(x => !x.suggested), events[0], ...ideas, ...events].filter(Boolean);
  const photos = [], seen = new Set();
  for (const item of candidates) {
    const src = https(item.image), url = https(item.url);
    if (!src || !url || seen.has(src)) continue;
    seen.add(src);
    photos.push({src, url, alt: item.imageAlt || item.title, title: item.title, source: item.source || 'Photo source', id: item.id});
    if (photos.length === 2) break;
  }
  return photos;
}
export function headerPhotosForEdition(brief) {
  return (brief.photography?.photos || []).filter(x => https(x.src) && https(x.url) && x.alt && x.title).slice(0,2);
}
