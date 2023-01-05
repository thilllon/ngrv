import crypto from 'crypto';
import { rmSync } from 'fs';
import { join } from 'path';
import { defaultOptions, engrave, readEngrave } from './ngrv';

const rootDir = process.cwd();
const filename = defaultOptions.filename;
const testDir1 = 'tmp';

const getRandomString = (size = 8) => crypto.randomBytes(size).toString('hex');

beforeAll(async () => {
  rmSync(join(rootDir, filename), { recursive: true, force: true });
  rmSync(join(rootDir, filename), { recursive: true, force: true });
  rmSync(join(rootDir, testDir1), { recursive: true, force: true });
});

test('should be able to read the engrave', async () => {
  engrave();

  const ngrvs = readEngrave({ silent: true });
  if (ngrvs) {
    Object.entries(ngrvs).forEach(([key, value]) => {
      expect(process.env[key]).toBe(value);
    });
  } else {
    expect(ngrvs).toBeUndefined();
  }
});

test('should be configurable fixture location', async () => {
  const directory = testDir1;
  const filename = getRandomString();
  const ngrvsInit = engrave({ directory, filename });

  const ngrvs = readEngrave({ directory, filename });
  if (ngrvs) {
    const keys = Object.keys(ngrvs);

    expect(ngrvsInit).toEqual(ngrvs);

    expect(new Date(ngrvs.NGRV_BUILT_AT)).not.toBe('Invalid Date');
    expect(new Date(ngrvs.NGRV_BUILT_AT)).toBeInstanceOf(Date);

    expect(ngrvs.NGRV_COMMIT_HASH).toHaveLength(40);
    expect(ngrvs.NGRV_COMMIT_HASH).toBeDefined();
    expect(ngrvs.NGRV_COMMIT_HASH).toMatch(/^[0-9a-f]{40}$/);

    for (const key of keys) {
      expect(typeof process.env[key]).toBe('string');
    }
  } else {
    expect(ngrvs).toBeUndefined();
  }
});
