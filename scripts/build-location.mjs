import {lstat, mkdir, mkdtemp, rename, symlink, realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';

export const localBuildCache = () => process.platform === 'darwin'
  ? join(homedir(), 'Library', 'Caches', 'ArielMorningEdit')
  : join(process.cwd(), '.cache');

// Documents synchronization can recreate numbered copies while dist is rebuilt.
// Keep the generated tree outside that folder; the conventional dist path stays
// usable by all checks. Preserve the entire previous output before the move.
export async function ensureBuildLocation(root, {platform = process.platform, cache = localBuildCache()} = {}) {
  const output = join(root, 'dist');
  await mkdir(cache, {recursive: true});
  let existing;
  try { existing = await lstat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing?.isSymbolicLink()) return realpath(output);
  if (platform !== 'darwin') { await mkdir(output, {recursive: true}); return output; }
  if (existing && !existing.isDirectory()) throw Error('Unexpected build output; preserve it and inspect the dist path');
  const target = await mkdtemp(join(cache, 'build-dist-'));
  const backup = target + '-previous';
  if (existing) await rename(output, backup);
  try { await symlink(target, output, 'dir'); }
  catch (error) { if (existing) await rename(backup, output); throw error; }
  return realpath(target);
}
