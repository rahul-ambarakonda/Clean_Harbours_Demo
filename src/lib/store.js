import { promises as fs } from 'fs';
import * as path from 'path';

const DATA_DIR = './data';
const WAITLIST_FILE = path.join(DATA_DIR, 'waitlist.json');
const WAITLIST_TMP_FILE = path.join(DATA_DIR, 'waitlist.json.tmp');

let writePromise = Promise.resolve();

async function readStore() {
  try {
    const content = await fs.readFile(WAITLIST_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File not found, return initial structure
      return { version: 1, entries: [] };
    }
    // If file is malformed or other error, log and return initial structure
    console.error(`Error reading store: ${error.message}`);
    return { version: 1, entries: [] };
  }
}

async function writeStore(data) {
  writePromise = writePromise.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(WAITLIST_TMP_FILE, json, 'utf8');
    await fs.rename(WAITLIST_TMP_FILE, WAITLIST_FILE);
  }).catch(error => {
    console.error(`Error writing store: ${error.message}`);
    throw error; // Re-throw to propagate the error in the chain
  });
  return writePromise;
}

export async function hasEmail(email) {
  const store = await readStore();
  const normalizedEmail = email.trim().toLowerCase();
  return store.entries.some(entry => entry.email === normalizedEmail);
}

export async function addEntry(email, ip) {
  const normalizedEmail = email.trim().toLowerCase();
  const store = await readStore();

  if (store.entries.some(entry => entry.email === normalizedEmail)) {
    throw new Error('ALREADY_JOINED');
  }

  const newEntry = {
    email: normalizedEmail,
    joinedAt: new Date().toISOString(),
    ip,
  };
  store.entries.push(newEntry);
  await writeStore(store);
  return newEntry;
}

export { readStore };
