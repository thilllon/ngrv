import { beforeAll, describe, expect, it, test } from '@jest/globals';
import crypto from 'crypto';
import { rmSync } from 'fs';
import { join } from 'path';
import { engrave, engraveDefaultOptions, readEngrave } from '../src/ngrv';

const rootDir = process.cwd();
const filename = engraveDefaultOptions.filename;
const testDir1 = 'tmp';

const getRandomString = (size = 8) => crypto.randomBytes(size).toString('hex');

describe('ngrv', () => {
  beforeAll(async () => {
    rmSync(join(rootDir, filename), { recursive: true, force: true });
    rmSync(join(rootDir, testDir1), { recursive: true, force: true });
  });

  it('should be defined', async () => {
    const ngrvs = engrave({ silent: true });
    expect(ngrvs).toBeDefined();
  });

  test('should be able to read the engrave', async () => {
    engrave({ silent: true });

    const ngrvs = readEngrave({ silent: true });
    if (ngrvs) {
      Object.entries(ngrvs).forEach(([key, value]) => {
        expect(process.env[key]).toBe(value);
      });
    } else {
      expect(ngrvs).toBeUndefined();
    }
  });

  test('should be configurable', async () => {
    const directory = testDir1;
    const filename = getRandomString();
    const ngrvsInit = engrave({ outputDirectory: directory, filename, silent: true });

    const ngrvs = readEngrave({ directory, filename, silent: true });
    if (ngrvs) {
      const keys = Object.keys(ngrvs);

      expect(ngrvsInit).toStrictEqual(ngrvs);

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
});
