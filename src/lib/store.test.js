
import { expect } from 'chai';
import sinon from 'sinon';
import { promises as fs } from 'fs';
import * as path from 'path';
import { addEntry, hasEmail, readStore } from './store.js';

describe('Store Module', () => {
  let readFileStub;
  let writeFileStub;
  let renameStub;
  let mkdirStub;
  let joinStub;

  const MOCK_DATA_DIR = './test-data';
  const MOCK_WAITLIST_FILE = path.join(MOCK_DATA_DIR, 'waitlist.json');
  const MOCK_WAITLIST_TMP_FILE = path.join(MOCK_DATA_DIR, 'waitlist.json.tmp');

  const initialStoreContent = { version: 1, entries: [] };
  const existingStoreContent = {
    version: 1,
    entries: [{ email: 'existing@example.com', joinedAt: '2023-01-01T00:00:00.000Z', ip: '127.0.0.1' }],
  };

  beforeEach(() => {
    // Stub fs functions
    readFileStub = sinon.stub(fs, 'readFile');
    writeFileStub = sinon.stub(fs, 'writeFile');
    renameStub = sinon.stub(fs, 'rename');
    mkdirStub = sinon.stub(fs, 'mkdir');

    // Stub path.join to redirect to mock data directory
    joinStub = sinon.stub(path, 'join');
    joinStub.withArgs('./data', 'waitlist.json').returns(MOCK_WAITLIST_FILE);
    joinStub.withArgs('./data', 'waitlist.json.tmp').returns(MOCK_WAITLIST_TMP_FILE);

    // Default behavior for mkdir
    mkdirStub.returns(Promise.resolve());
  });

  afterEach(() => {
    sinon.restore(); // Restore all stubs after each test
  });

  describe('readStore', () => {
    it('should return initial structure if file does not exist', async () => {
      readFileStub.throws(Object.assign(new Error('File not found'), { code: 'ENOENT' }));
      const store = await readStore();
      expect(store).to.deep.equal(initialStoreContent);
    });

    it('should return parsed content if file exists', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(existingStoreContent)));
      const store = await readStore();
      expect(store).to.deep.equal(existingStoreContent);
    });

    it('should return initial structure if file is malformed JSON', async () => {
      readFileStub.returns(Promise.resolve('invalid json'));
      const store = await readStore();
      expect(store).to.deep.equal(initialStoreContent);
    });

    it('should return initial structure if another error occurs during read', async () => {
      readFileStub.throws(new Error('Permission denied'));
      const store = await readStore();
      expect(store).to.deep.equal(initialStoreContent);
    });
  });

  describe('hasEmail', () => {
    it('should return true if email exists (case-insensitive and trimmed)', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(existingStoreContent)));
      const result = await hasEmail('  Existing@example.com  ');
      expect(result).to.be.true;
    });

    it('should return false if email does not exist', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(initialStoreContent)));
      const result = await hasEmail('nonexistent@example.com');
      expect(result).to.be.false;
    });
  });

  describe('addEntry', () => {
    it('should add a new entry to the store', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(initialStoreContent)));
      const newEmail = 'new@example.com';
      const ip = '192.168.1.1';

      // Capture the content written to the file
      let writtenContent = null;
      writeFileStub.callsFake(async (filePath, content) => {
        if (filePath === MOCK_WAITLIST_TMP_FILE) {
          writtenContent = JSON.parse(content);
        }
        return Promise.resolve();
      });
      renameStub.returns(Promise.resolve());

      const entry = await addEntry(newEmail, ip);

      expect(entry).to.have.property('email').and.to.equal(newEmail);
      expect(entry).to.have.property('ip').and.to.equal(ip);
      expect(entry).to.have.property('joinedAt');
      expect(writtenContent.entries).to.have.lengthOf(1);
      expect(writtenContent.entries[0].email).to.equal(newEmail);
      expect(writeFileStub.calledOnce).to.be.true;
      expect(renameStub.calledOnce).to.be.true;
      expect(mkdirStub.calledOnce).to.be.true; // Check that mkdir was called
    });

    it('should throw an error if email already exists', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(existingStoreContent)));
      const existingEmail = 'existing@example.com';
      const ip = '192.168.1.1';

      try {
        await addEntry(existingEmail, ip);
        expect.fail('Should have thrown ALREADY_JOINED error');
      } catch (error) {
        expect(error.message).to.equal('ALREADY_JOINED');
        expect(writeFileStub.notCalled).to.be.true; // Ensure no write operation
        expect(renameStub.notCalled).to.be.true;
      }
    });

    it('should normalize email (trim and lowercase) before adding', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(initialStoreContent)));
      const emailWithCaseAndSpaces = '  TeSt.EmAiL@eXaMpLe.CoM  ';
      const expectedNormalizedEmail = 'test.email@example.com';
      const ip = '1.2.3.4';

      let writtenContent = null;
      writeFileStub.callsFake(async (filePath, content) => {
        if (filePath === MOCK_WAITLIST_TMP_FILE) {
          writtenContent = JSON.parse(content);
        }
        return Promise.resolve();
      });
      renameStub.returns(Promise.resolve());

      await addEntry(emailWithCaseAndSpaces, ip);
      expect(writtenContent.entries[0].email).to.equal(expectedNormalizedEmail);
    });

    it('should handle sequential writes correctly', async () => {
      readFileStub.returns(Promise.resolve(JSON.stringify(initialStoreContent)));
      renameStub.returns(Promise.resolve());
      mkdirStub.returns(Promise.resolve());

      const writtenContents = [];
      writeFileStub.callsFake(async (filePath, content) => {
        writtenContents.push(JSON.parse(content));
        return Promise.resolve();
      });

      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      await Promise.all([addEntry(email1, '1.1.1.1'), addEntry(email2, '2.2.2.2')]);

      // Due to writePromise, these should be sequential
      expect(writeFileStub.calledTwice).to.be.true;
      expect(renameStub.calledTwice).to.be.true;

      expect(writtenContents[0].entries).to.have.lengthOf(1);
      expect(writtenContents[0].entries[0].email).to.equal(email1);

      expect(writtenContents[1].entries).to.have.lengthOf(2);
      expect(writtenContents[1].entries.some(e => e.email === email1)).to.be.true;
      expect(writtenContents[1].entries.some(e => e.email === email2)).to.be.true;
    });
  });
});
