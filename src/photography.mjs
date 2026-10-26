// Atmospheric header photography is curated separately from recommendations.
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; } };
const valid = photo => photo && https(photo.src) && https(photo.url) && typeof photo.alt === 'string' && photo.alt.trim();
export function selectHeaderPhotos(brief, catalog = {}) {
  // A missing current photo must not silently turn event cards into highlights again.
  return (catalog.photos || []).filter(photo => valid(photo) && photo.source &&
    /^\d{4}-\d{2}-\d{2}$/.test(photo.day) && photo.day <= brief.day &&
    /^\d{4}-\d{2}-\d{2}$/.test(photo.availableThrough) && photo.availableThrough >= brief.day)
    .sort((a,b) => b.day.localeCompare(a.day)).slice(0,1);
}
export function headerPhotosForEdition(brief) {
  const single = brief.photography?.mode === 'atmosphere';
  // Keep the original two-photo treatment in older archived editions.
  return (brief.photography?.photos || []).filter(photo => valid(photo) && (single ? photo.source : photo.title)).slice(0,single ? 1 : 2);
}
