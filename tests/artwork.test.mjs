import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectArtwork} from '../scripts/artwork.mjs';
import {artworkForEdition,defaultArtwork,seasonForDay} from '../src/artwork.mjs';

test('daily artwork respects New York seasons, retains older art honestly, and ignores missing or future files',async()=>{
 const cwd=process.cwd(),root=await mkdtemp(join(tmpdir(),'newsletter-art-'));process.chdir(root);
 try{
  await mkdir('public/assets/artwork',{recursive:true});
  const art={day:'2026-10-02',src:'assets/artwork/2026-10-02-autumn-window.png',alt:'Autumn illustration',season:'autumn',generatedAt:'2026-10-02T08:00:00Z'};
  await writeFile('public/'+art.src,'image fixture');
  assert.equal((await selectArtwork([art],'2026-10-02',new Date('2026-10-02T09:00Z'))).status.state,'fresh');
  const later=await selectArtwork([art,{...art,day:'2026-10-03',src:'assets/artwork/2026-10-03-missing.png'}],'2026-10-03',new Date('2026-10-03T09:00Z'));
  assert.equal(later.status.state,'stale');assert.equal(later.artwork.day,'2026-10-02');assert.equal(later.status.updatedAt,art.generatedAt);
  assert.equal((await selectArtwork([art],'2026-10-01',new Date('2026-10-01T09:00Z'))).status.state,'unavailable');
  assert.equal((await selectArtwork([{...art,season:'spring'}],'2026-10-02',new Date('2026-10-02T09:00Z'))).status.state,'stale');
 }finally{process.chdir(cwd);await rm(root,{recursive:true,force:true});}
 assert.deepEqual(['2026-01-01','2026-04-01','2026-07-01','2026-10-01'].map(seasonForDay),['winter','spring','summer','autumn']);
});
test('legacy editions retain the original artwork and unsafe paths cannot become image requests',()=>{
 assert.equal(artworkForEdition(undefined),defaultArtwork);
 for(const src of ['https://example.com/tracker.png','assets/artwork/../../config/security.local.json','/assets/artwork/2026-10-02-test.png'])assert.equal(artworkForEdition({src,alt:'test'}),defaultArtwork);
});
