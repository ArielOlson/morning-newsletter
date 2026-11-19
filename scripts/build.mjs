import {ensureBuildLocation, localBuildCache} from './build-location.mjs';
import {build} from 'vite';
import {readFile,writeFile,mkdir,cp,rm,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareArchive} from './archive.mjs';
import {encrypt,decrypt} from '../src/crypto.mjs';
import {recommendationHistory} from './city-history.mjs';
import {assertRecommendations} from './recommendation-check.mjs';
const config=JSON.parse(await readFile('config/security.local.json','utf8'));
if(typeof config.password!=='string'||config.password.length<1)throw new Error('Set a newsletter password in the local security configuration before building.');
const text=await readFile('public/data/brief.json','utf8');
const brief=JSON.parse(text);if(brief.version!==1||!brief.day||!brief.calendar)throw new Error('Prepare a valid newsletter edition before building.');
assertRecommendations(brief,(await recommendationHistory(brief.day,{},brief.timezone)).items);
const archive=await prepareArchive(text,config.password);
let envelope;
try { const old=JSON.parse(await readFile('dist/data/brief.enc.json','utf8'));if(await decrypt(old,config.password)===text)envelope=old; } catch(error) { if(error.code!=='ENOENT')throw error; }
envelope ||= await encrypt(text,config.password);
if(await decrypt(envelope,config.password)!==text)throw new Error('Encrypted edition verification failed.');
// Keep generated output and staging away from macOS Documents synchronization.
// The prior output is preserved by ensureBuildLocation before any cleanup.
const output = await ensureBuildLocation(process.cwd());
await mkdir(localBuildCache(), {recursive:true});
const staging = await mkdtemp(resolve(localBuildCache(), 'build-public-'));
try {
  await cp('public/assets', resolve(staging,'assets'), {recursive:true});
  await cp('src/not-found.html', resolve(staging,'404.html'));
  await build({publicDir:staging, outDir:output, emptyOutDir:true});
} finally { await rm(staging,{recursive:true,force:true}); }
await mkdir('dist/data',{recursive:true});
await writeFile('dist/data/brief.enc.json',JSON.stringify(envelope));
await mkdir('dist/data/editions',{recursive:true});
await writeFile('dist/data/archive.enc.json',JSON.stringify(archive.index));
for(const item of archive.files)await writeFile(`dist/data/${item.file}`,JSON.stringify(item.envelope));
console.log('Built encrypted newsletter. No plaintext edition is included.');
