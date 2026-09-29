import {build} from 'vite';
import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {encrypt,decrypt} from '../src/crypto.mjs';
const config=JSON.parse(await readFile('config/security.local.json','utf8'));
if(typeof config.password!=='string'||config.password.length<1)throw new Error('Set a newsletter password in the local security configuration before building.');
const text=await readFile('public/data/brief.json','utf8');
const brief=JSON.parse(text);if(brief.version!==1||!brief.day||!brief.calendar)throw new Error('Prepare a valid newsletter edition before building.');
const envelope=await encrypt(text,config.password);
if(await decrypt(envelope,config.password)!==text)throw new Error('Encrypted edition verification failed.');
// Do not let Vite copy the plaintext public/data directory into the release, even briefly.
await rm('.cache/build-public',{recursive:true,force:true});
await mkdir('.cache/build-public/assets',{recursive:true});
await cp('public/assets','.cache/build-public/assets',{recursive:true});
await build({publicDir:resolve('.cache/build-public')});
await mkdir('dist/data',{recursive:true});
await writeFile('dist/data/brief.enc.json',JSON.stringify(envelope));
console.log('Built encrypted newsletter. No plaintext edition is included.');
