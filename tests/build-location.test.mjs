import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ensureBuildLocation} from '../scripts/build-location.mjs';
test('Mac build output leaves synchronized Documents while preserving every prior output file', async () => {
  const root = await mkdtemp(join(tmpdir(),'morning-build-test-')), cache = join(root,'local-cache');
  try {
    await mkdir(join(root,'dist','data'),{recursive:true});
    await writeFile(join(root,'dist','data','archive.enc.json'),'original encrypted bytes');
    await writeFile(join(root,'dist','photo 6.jpg'),'unpublished conflict copy');
    const target = await ensureBuildLocation(root,{platform:'darwin',cache});
    assert.equal(await realpath(join(root,'dist')),target);
    assert.equal(await readFile(target+'-previous/data/archive.enc.json','utf8'),'original encrypted bytes');
    assert.equal(await readFile(target+'-previous/photo 6.jpg','utf8'),'unpublished conflict copy');
    await writeFile(join(root,'dist','index.html'),'new build');
    assert.equal(await readFile(join(target,'index.html'),'utf8'),'new build');
    assert.equal(await ensureBuildLocation(root,{platform:'darwin',cache}),target,'Reuse the stable target on subsequent builds');
  } finally {await rm(root,{recursive:true,force:true});}
});
