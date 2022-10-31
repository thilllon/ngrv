import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { defaultOptions, engrave, readEngrave } from './ngrv';

const rootDir = process.cwd();
const builtAtFile = defaultOptions.builtAtFile;
const commitHashFile = defaultOptions.commitHashFile;
const directory = '.ngrv';

const getRandomString = (size = 8) => crypto.randomBytes(size).toString('hex');

beforeAll(async () => {
  fs.rmSync(path.join(rootDir, builtAtFile), { recursive: true, force: true });
  fs.rmSync(path.join(rootDir, commitHashFile), { recursive: true, force: true });
  fs.rmSync(path.join(rootDir, directory), { recursive: true, force: true });
});

test('should be able to read the engrave', async () => {
  engrave();

  const builtAtPath = path.join(rootDir, builtAtFile);
  const builtAt = fs.readFileSync(builtAtPath, 'utf8');
  expect(new Date(builtAt)).not.toBe('Invalid Date');
  expect(new Date(builtAt)).toBeInstanceOf(Date);

  const commitHashPath = path.join(rootDir, commitHashFile);
  const commitHash = fs.readFileSync(commitHashPath, 'utf8');
  expect(commitHash).toHaveLength(40);
  expect(commitHash).toBeDefined();
  expect(commitHash).toMatch(/^[0-9a-f]{40}$/);

  readEngrave({ silent: true });

  expect(typeof process.env[builtAtFile]).toBe('string');
  expect(typeof process.env[commitHashFile]).toBe('string');
  expect(process.env[builtAtFile]).toBe(builtAt);
  expect(process.env[commitHashFile]).toBe(commitHash);
});

test('should be configurable fixture location', async () => {
  const builtAtFile = 'BUILT_AT_' + getRandomString();
  const commitHashFile = 'COMMIT_HASH_' + getRandomString();
  engrave({ directory, builtAtFile, commitHashFile });

  const builtAtPath = path.join(rootDir, directory, builtAtFile);
  const builtAt = fs.readFileSync(builtAtPath, 'utf8');
  expect(new Date(builtAt)).not.toBe('Invalid Date');
  expect(new Date(builtAt)).toBeInstanceOf(Date);

  const commitHashPath = path.join(rootDir, directory, commitHashFile);
  const commitHash = fs.readFileSync(commitHashPath, 'utf8');
  expect(commitHash).toHaveLength(40);
  expect(commitHash).toBeDefined();
  expect(commitHash).toMatch(/^[0-9a-f]{40}$/);

  readEngrave({ directory, builtAtFile, commitHashFile, silent: true });

  expect(typeof process.env[builtAtFile]).toBe('string');
  expect(typeof process.env[commitHashFile]).toBe('string');
  expect(process.env[builtAtFile]).toBe(builtAt);
  expect(process.env[commitHashFile]).toBe(commitHash);
});

// test('fail to read', async () => {
//   const directory = getRandomString();
//   expect(readEngrave({ directory, silent: true })).toBeUndefined();
//   // expect(readEngrave({ directory, silent: true })).toThrow();
// });

afterAll(async () => {
  fs.rmSync(path.join(rootDir, builtAtFile), { recursive: true, force: true });
  fs.rmSync(path.join(rootDir, commitHashFile), { recursive: true, force: true });
  fs.rmSync(path.join(rootDir, directory), { recursive: true, force: true });
});
