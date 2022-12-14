import chalk from 'chalk';
import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import { join } from 'path';

const NgrvKey = [
  'NGRV_BUILT_AT',
  'NGRV_BUILT_AT_ISO',
  'NGRV_COMMIT_HASH',
  'NGRV_ENDIANNESS',
  'NGRV_ARCH',
  'NGRV_HOMEDIR',
  'NGRV_TOTALMEM',
  'NGRV_USERNAME',
  'NGRV_SHELL',
  'NGRV_CPUMODEL',
  'NGRV_NCPUS',
] as const;

type NgrvKey = typeof NgrvKey[number];

export type Ngrv = {
  NGRV_BUILT_AT: string;
  NGRV_BUILT_AT_ISO: string;
  NGRV_COMMIT_HASH: string;
  NGRV_ENDIANNESS: string;
  NGRV_ARCH: string;
  NGRV_HOMEDIR: string;
  NGRV_TOTALMEM: string;
  NGRV_USERNAME: string;
  NGRV_SHELL: string;
  NGRV_CPUMODEL: string;
  NGRV_NCPUS: string;
};

export type NgrvOptions = {
  /**
   * @default .
   */
  directory?: string;

  /**
   * @default NGRV
   */
  filename?: string;

  /**
   * @default false
   */
  silent?: boolean;
};

export const defaultOptions = {
  directory: '.',
  filename: '.ngrv',
  silent: false,
} as const;

let _silent = false;

const logger = ((): Console => (_silent ? ({} as any) : console))();

export const engrave = (options: NgrvOptions = defaultOptions): Ngrv => {
  const { directory, filename, silent } = { ...defaultOptions, ...options };
  _silent = silent;

  const folderPath = join(process.cwd(), directory);
  mkdirSync(folderPath, { recursive: true });

  const builtAt = Date.now().toString();
  const iso = new Date(parseInt(builtAt, 10)).toISOString();
  const commitHash = execSync('git rev-parse HEAD || true').toString('utf8').trim();
  const endianness = os.endianness() ?? '';
  const arch = os.arch() ?? '';
  const homedir = os.homedir() ?? '';
  const totalmem = os.totalmem().toString();
  const username = os.userInfo().username ?? '';
  const shell = os.userInfo().shell ?? '';
  const cpumodel = os.cpus()[0].model ?? '';
  const ncpus = os.cpus().length.toString();

  const ngrvs: Ngrv = {
    NGRV_BUILT_AT: builtAt,
    NGRV_BUILT_AT_ISO: iso,
    NGRV_COMMIT_HASH: commitHash,
    NGRV_ENDIANNESS: endianness,
    NGRV_ARCH: arch,
    NGRV_HOMEDIR: homedir,
    NGRV_TOTALMEM: totalmem,
    NGRV_USERNAME: username,
    NGRV_SHELL: shell,
    NGRV_CPUMODEL: cpumodel,
    NGRV_NCPUS: ncpus,
  } as const;

  Object.entries(ngrvs).forEach(([key, value]) => (process.env[key] = value));

  try {
    const data = Object.entries(ngrvs)
      .map(([key, value]) => `${key}="${value}"`)
      .join('\n');

    const ngrvPath = join(folderPath, filename);
    writeFileSync(ngrvPath, data, 'utf8');
    logger.log(chalk.greenBright(`[ngrv] Saved at ${ngrvPath}`));
  } catch (err: any) {
    logger.error(err?.message);
  }

  return ngrvs;
};

export const readEngrave = (options: NgrvOptions = defaultOptions): Ngrv | undefined => {
  try {
    const { directory, filename, silent } = { ...defaultOptions, ...options };
    _silent = silent;

    const folderPath = join(process.cwd(), directory);
    const ngrvPath = join(folderPath, filename);
    const data = readFileSync(ngrvPath, 'utf8').trim();
    const ngrvs = data
      .split('\r\n')
      .join('\n')
      .split('\n')
      .map<{ key: NgrvKey; value: string }>((line) => {
        const [key, ...others] = line.split('=');
        const value = others.join('=').slice(1, -1).trim();
        return { key: key as NgrvKey, value };
      })
      .reduce<Ngrv>((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as Ngrv);

    Object.entries(ngrvs).forEach(([key, value]) => (process.env[key] = value));

    logger.log(chalk.greenBright(`[ngrv] Read from ${ngrvPath}`));

    return ngrvs;
  } catch (err: any) {
    logger.error(err?.message);
  }
};
