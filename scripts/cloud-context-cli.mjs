import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decrypt} from '../src/crypto.mjs';
import {atomicJSON, readJSON, hash} from './workflow-utils.mjs';
import {operationsRepository, contextFile, packContext, restoreContext, validateContext, readRepositoryFile} from './cloud-context.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const command = process.argv[2];
const pendingPath = '.cache/cloud-context-upload.local.json';
const statePath = '.cache/cloud-context-state.local.json';
const envelopePath = '.cache/cloud-transfer/operations.enc.json';
const api = (path, body) => new Promise((resolve, reject) => {
  const args = ['api', path, ...(body ? ['--method','PUT','--input','-'] : [])];
  const child = spawn('gh', args, {stdio: ['pipe','pipe','pipe'], timeout: 30000});
  let stdout = ''; let stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  child.on('error', () => reject(Error('GitHub access is unavailable')));
  child.on('close', code => {
    if (code) { const error = Error('GitHub working-data request failed'); error.notFound = /HTTP 404/.test(stderr); reject(error); }
    else try { resolve(JSON.parse(stdout)); } catch { reject(Error('Unexpected GitHub response')); }
  });
  child.stdin.end(body ? JSON.stringify(body) : undefined);
});
try {
  if (!['pack','push','pull'].includes(command)) throw Error('Use cloud:context pack, push or pull');
  const security = await readJSON('config/security.local.json', {});
  const password = process.env.MORNING_NEWSLETTER_PASSWORD || security.password;
  if (typeof password !== 'string' || !password) throw Error('Configure the newsletter password through the private cloud secret facility');
  if (security.password && security.password !== password) throw Error('Cloud secret differs from existing private configuration; do not rotate the newsletter password');
  const root = process.cwd();
  if (command === 'pack') {
    const result = await packContext(root, password);
    await atomicJSON(envelopePath, result.envelope);
    console.log(JSON.stringify({encrypted: true, fileCount: result.fileCount, path: envelopePath}));
  } else {
    const repo = await api('repos/' + operationsRepository);
    if (!repo.private || repo.full_name !== operationsRepository) throw Error('Working data requires the designated private operations repository');
    let remote;
    try { remote = await api('repos/' + operationsRepository + '/contents/' + contextFile); }
    catch (error) { if (!error.notFound) throw error; }
    if (command === 'pull') {
      if (!remote) throw Error('Encrypted working data has not been uploaded');
      const envelope = JSON.parse(await readRepositoryFile(api,remote));
      // Authenticate and validate before creating any private working files.
      validateContext(JSON.parse(await decrypt(envelope, password)));
      const result = await restoreContext(root, envelope, password);
      if (!security.password) await atomicJSON('config/security.local.json', {password});
      await atomicJSON(statePath, {repository: operationsRepository, sha: remote.sha, restoredAt: new Date().toISOString()});
      console.log(JSON.stringify({...result, confirmed: true, repository: operationsRepository}));
    } else {
      let prior = await readJSON(statePath, {});
      const pending = await readJSON(pendingPath,null);
      if(remote && pending?.repository === operationsRepository && pending.digest === hash(await readRepositoryFile(api,remote))) {
        await atomicJSON(statePath,{repository:operationsRepository,sha:remote.sha,savedAt:new Date().toISOString()});
        prior = await readJSON(statePath);
      }
      if(remote && !prior.sha && process.argv.includes('--initialize')) {
        const saved = validateContext(JSON.parse(await decrypt(JSON.parse(await readRepositoryFile(api,remote)),password)));
        const local = await packContext(root,password);
        const current = JSON.parse(await decrypt(local.envelope,password));
        if(JSON.stringify(saved.files)!==JSON.stringify(current.files))throw Error('Existing remote working data differs; preserve it and reconcile');
        await atomicJSON(statePath,{repository:operationsRepository,sha:remote.sha,savedAt:new Date().toISOString()});
        console.log(JSON.stringify({confirmed:true,encrypted:true,fileCount:Object.keys(saved.files).length,repository:operationsRepository,recoveredInitialConfirmation:true}));
        process.exit(0);
      }
      if (remote && (prior.repository !== operationsRepository || prior.sha !== remote.sha)) throw Error('Remote working data changed or has not been restored; reconcile before uploading');
      if (!remote && !process.argv.includes('--initialize')) throw Error('Use --initialize only for the first encrypted upload');
      if (!remote && prior.sha) throw Error('The previous remote working data is missing; preserve the local copy and investigate');
      const {envelope, fileCount} = await packContext(root, password);
      const body = {message: 'Preserve encrypted newsletter working data', content: Buffer.from(JSON.stringify(envelope)).toString('base64'), ...(remote ? {sha: remote.sha} : {})};
      await atomicJSON(pendingPath,{repository:operationsRepository,digest:hash(JSON.stringify(envelope)),previousSha:remote?.sha || null,startedAt:new Date().toISOString()});
      const written = await api('repos/' + operationsRepository + '/contents/' + contextFile, body);
      const confirmed = await api('repos/' + operationsRepository + '/contents/' + contextFile);
      if (!written.content?.sha || confirmed.sha !== written.content.sha || await readRepositoryFile(api,confirmed) !== JSON.stringify(envelope)) throw Error('The encrypted upload could not be confirmed');
      await atomicJSON(statePath, {repository: operationsRepository, sha: confirmed.sha, savedAt: new Date().toISOString()});
      console.log(JSON.stringify({confirmed: true, encrypted: true, fileCount, repository: operationsRepository, commit: written.commit?.sha}));
    }
  }
} catch (error) {
  // Do not expose API responses, encrypted contents, private records or secrets.
  console.error(error.name === 'AssertionError' || error.name === 'SyntaxError' || error.name === 'OperationError'
    ? 'Private working-data validation failed; previous files were preserved. Inspect the schema and secret privately.'
    : error.message);
  process.exitCode = 1;
}
