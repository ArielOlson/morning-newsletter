export const transientStatus = status => [408, 429, 500, 502, 503, 504].includes(status);
export function retryDelay(value, {now = Date.now(), minimum = 30000} = {}) {
  const seconds = value === null || value === undefined ? NaN : Number(value);
  const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Math.max(minimum, Number.isFinite(parsed) ? parsed : minimum);
}
