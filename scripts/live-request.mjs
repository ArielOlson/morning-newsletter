// Bounded GET retries preserve strict status checks in the caller. A transient
// CDN error must never count as a missing plaintext endpoint.
export async function requestLive(path, website, {fetcher=fetch, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)), now=Date.now, cacheBust=true}={}) {
 for(let attempt=0;attempt<2;attempt++) {
  const url=new URL(path,website),base=new URL(website);
  const hosted=url.origin===base.origin&&url.pathname.startsWith(base.pathname);
  // Third-party photo URLs may be signed or reject unfamiliar query parameters.
  if(cacheBust&&hosted)url.searchParams.set('verify',`${now()}-${attempt}`);
  let response;
  try { response=await fetcher(url,{cache:hosted?'no-store':'default',headers:hosted?{'Cache-Control':'no-cache'}:{},signal:AbortSignal.timeout(20000)}); }
  catch(error) { if(attempt)throw error;await sleep(2000);continue; }
  if(attempt||![408,429,500,502,503,504].includes(response.status))return response;
  const retry=response.headers.get('retry-after');
  const seconds=retry===null?NaN:Number(retry);
  const wait=Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-now();
  // Long Retry-After responses remain failures for the caller to report.
  if(wait>60000)return response;
  await response.body?.cancel();await sleep(Math.max(2000,Number.isFinite(wait)?wait:2000));
 }
}
