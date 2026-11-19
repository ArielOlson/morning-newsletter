import {transientStatus, retryDelay} from './retry-policy.mjs';
// Bounded GET retries preserve strict status checks in the caller. A transient
// CDN error must never count as a missing plaintext endpoint.
export async function requestLive(path, website, {fetcher=fetch, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)), now=Date.now, cacheBust=true, attempts=2, onBackoff=()=>{}}={}) {
 if(![1,2].includes(attempts))throw new Error('Live requests permit at most one retry.');
 for(let attempt=0;attempt<attempts;attempt++) {
  const url=new URL(path,website),base=new URL(website);
  const hosted=url.origin===base.origin&&url.pathname.startsWith(base.pathname);
  // Third-party photo URLs may be signed or reject unfamiliar query parameters.
  if(cacheBust&&hosted)url.searchParams.set('verify',`${now()}-${attempt}`);
  let response;
  try { response=await fetcher(url,{cache:hosted?'no-store':'default',headers:hosted?{'Cache-Control':'no-cache'}:{},signal:AbortSignal.timeout(20000),redirect:'manual'}); }
  catch(error) { if(attempt+1===attempts)throw error;onBackoff(30000);await sleep(30000);continue; }
  if(attempt+1===attempts||!transientStatus(response.status))return response;
  const wait=retryDelay(response.headers.get('retry-after'),{now:now()});
  // Long Retry-After responses remain failures for the caller to report.
  if(wait>60000)return response;
  await response.body?.cancel();onBackoff(wait);await sleep(wait);
 }
}
