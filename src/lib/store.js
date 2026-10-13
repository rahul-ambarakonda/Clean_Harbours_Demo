import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '../../data');
const storeFilePath = join(dataDir, 'waitlist.json');
const tempStoreFilePath = join(dataDir, 'waitlist.json.tmp');

let writePromise = Promise.resolve();

async function readStore() {
  try {
    const content = await fs.readFile(storeFilePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { version: 1, entries: [] };
    }
    throw error;
  }
}

async function writeStore(data) {
  // Ensure data directory exists
  await fs.mkdir(dataDir, { recursive: true });

  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(tempStoreFilePath, json, 'utf8');
  await fs.rename(tempStoreFilePath, storeFilePath);
}

export async function hasEmail(email) {
  const store = await readStore();
  return store.entries.some(entry => entry.email === email);
}

export async function addEntry(email, ip) {
  writePromise = writePromise.then(async () => {
    const store = await readStore();
    store.entries.push({
      email,
      joinedAt: new Date().toISOString(),
      ip,
    });
    await writeStore(store);
  });
  return writePromise;
}

export { readStore };
