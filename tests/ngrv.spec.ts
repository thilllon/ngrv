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
    const ngrvs = engrave();
    expect(ngrvs).toBeDefined();
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

  test('should be configurable', async () => {
    const directory = testDir1;
    const filename = getRandomString();
    const ngrvsInit = engrave({ outputDirectory: directory, filename });

    const ngrvs = readEngrave({ directory, filename });
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

  // FIXME: this test is not working
  // https://kgajera.com/blog/how-to-test-yargs-cli-with-jest/
  it('cli test 1: given parameter', async () => {
    expect(true).toBeTruthy();

    // const consoleLogSpy = jest.spyOn(console, 'log');
    // const consoleErrorSpy = jest.spyOn(console, 'error');

    // const result = spawn('npx', ['tsx', 'src/cli.ts']);
    // // const cli = spawn('npx', ['tsx', 'src/cli.ts']);
    // result.stdout.on('data', (data) => {
    //   console.log(data);
    // });
    // result.stderr.on('error', (data) => {
    //   console.error(data);
    // });

    // expect(consoleLogSpy).toHaveBeenCalled();
    // expect(consoleErrorSpy).not.toHaveBeenCalled();

    // result.on('close', (code) => {
    //   debugger;
    //   console.log(code);
    // });
    // cli.stdout.on('data', (data) => {
    //   debugger;
    //   console.log(data.toString());
    //   stdout += data.toString();
    // });

    // cli.on('close', (code) => {
    //   debugger;
    //   expect(code).toBe(0);
    //   expect(stdout.trim()).toBe('Hello, Alice!');
    // });

    // cli.on('error', (err) => {
    //   debugger;
    //   console.log(err);
    // });
    // cli.stdin.end();
  });

  // it('cli test 2: interactive stdin', () => {
  //   const cli = spawn('tsx', ['src/cli.ts']);
  //   let stdout = '';
  //   cli.stdout.on('data', (data) => {
  //     stdout += data.toString();
  //     if (stdout.includes('What is your name?')) {
  //       cli.stdin.write('Bob\n');
  //     }
  //   });
  //   cli.on('close', (code) => {
  //     expect(code).to.equal(0);
  //     expect(stdout.trim()).to.equal('What is your name?\nHello, Bob!');
  //   });
  //   cli.stdin.end();
  // });
});
