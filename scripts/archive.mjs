import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {encrypt, decrypt} from '../src/crypto.mjs';
const validDay = day => /^\d{4}-\d{2}-\d{2}$/.test(day || '');
export async function prepareArchive(current, password) {
  const editions = new Map(), existing = new Map(), cache = '.cache/editions';
  await mkdir(cache, {recursive: true});
  let previous;
  try { previous = JSON.parse(await readFile('dist/data/archive.enc.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Decrypt before reuse: corrupted archives and a different password still fail closed.
  if (previous) {
    const index = JSON.parse(await decrypt(previous, password));
    for (const entry of index.editions) {
      if (!validDay(entry.day) || entry.file !== `editions/${entry.day}.enc.json` || existing.has(entry.day)) throw Error('Invalid archive index');
      const envelope = JSON.parse(await readFile(`dist/data/${entry.file}`, 'utf8'));
      const text = await decrypt(envelope, password), brief = JSON.parse(text);
      if (brief.day !== entry.day) throw Error('Archive date mismatch');
      editions.set(brief.day, text); existing.set(brief.day, {text, envelope});
    }
  }
  for (const file of await readdir(cache)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(file)) continue;
    const text = await readFile(`${cache}/${file}`, 'utf8'), brief = JSON.parse(text);
    if (brief.version !== 1 || !brief.calendar || brief.day !== file.slice(0, 10)) throw Error('Invalid cached edition');
    if (!editions.has(brief.day) || JSON.parse(editions.get(brief.day)).generatedAt < brief.generatedAt) editions.set(brief.day, text);
  }
  const brief = JSON.parse(current);
  if (!validDay(brief.day)) throw Error('Invalid current edition day');
  editions.set(brief.day, current);
  const index = {version: 1, editions: []}, files = [];
  await mkdir('public/data/editions', {recursive: true});
  for (const [day, text] of [...editions].sort(([a], [b]) => b.localeCompare(a))) {
    const edition = JSON.parse(text);
    for (const path of [`${cache}/${day}.json`, `public/data/editions/${day}.json`]) {
      let old; try { old = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (old !== text) await writeFile(path, text, {mode: 0o600});
    }
    index.editions.push({day, generatedAt: edition.generatedAt, file: `editions/${day}.enc.json`});
    const retained = existing.get(day);
    files.push({file: `editions/${day}.enc.json`, envelope: retained?.text === text ? retained.envelope : await encrypt(text, password)});
  }
  const text = JSON.stringify(index);
  await writeFile('public/data/archive.json', text, {mode: 0o600});
  return {index: previous && await decrypt(previous, password) === text ? previous : await encrypt(text, password), files};
}
