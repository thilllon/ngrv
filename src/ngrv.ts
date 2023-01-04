import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export type NgraveOptions = {
  /**
   * @default .
   */
  directory?: string;

  /**
   * @filename
   * @default NGRV_BUILT_AT
   */
  builtAtFile?: string;

  /**
   * @filename
   * @default NGRV_COMMIT_HASH
   */
  commitHashFile?: string;

  silent?: boolean;
};

export type Ngrave = {
  NGRV_COMMIT_HASH: string;
  NGRV_BUILT_AT: string;
};

export const defaultOptions = {
  directory: '.',
  builtAtFile: 'NGRV_BUILT_AT',
  commitHashFile: 'NGRV_COMMIT_HASH',
  silent: false,
} as const;

export const engrave = (options: NgraveOptions = defaultOptions): Ngrave => {
  const { directory, builtAtFile, commitHashFile, silent } = {
    ...defaultOptions,
    ...options,
  };
  const envs = {} as Ngrave;

  const folderPath = path.join(process.cwd(), directory);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  try {
    /**
     * @shell echo $(date -u +'%s')>./NGRV_BUILT_AT
     */
    const builtAt = Date.now().toString().trim();
    const iso = new Date(parseInt(builtAt, 10)).toISOString();
    const fpath = path.join(folderPath, builtAtFile);
    console.log(chalk.greenBright(`[ngrv] saved at ${fpath}`));
    console.log(chalk.greenBright(`[ngrv] ${builtAtFile}: ${builtAt} (${iso})`));
    fs.writeFileSync(fpath, builtAt, 'utf8');
    envs.NGRV_BUILT_AT = builtAt;
  } catch (err: any) {
    console.error(err?.message);
  }

  try {
    /**
     * @shell echo $(git rev-parse HEAD)>./NGRV_COMMIT_HASH
     */
    const commitHash = execSync('git rev-parse HEAD').toString('utf8').trim();
    const fpath = path.join(folderPath, commitHashFile);
    console.log(chalk.greenBright(`[ngrv] saved at ${fpath}`));
    console.log(chalk.greenBright(`[ngrv] ${commitHashFile}: ${commitHash}`));
    fs.writeFileSync(fpath, commitHash, 'utf8');
    envs.NGRV_COMMIT_HASH = commitHash;
  } catch (err: any) {
    console.error(err?.message);
  }

  return envs;
};

export const readEngrave = (options: NgraveOptions = defaultOptions) => {
  const { directory, builtAtFile, commitHashFile, silent } = {
    ...defaultOptions,
    ...options,
  };
  const envs = {} as Ngrave;

  const folderPath = path.join(process.cwd(), directory);

  try {
    const fpath = path.join(folderPath, builtAtFile);
    const builtAt = fs.readFileSync(fpath, 'utf8').trim();
    process.env[builtAtFile] = builtAt;
    envs.NGRV_BUILT_AT = builtAt;
    if (!silent) {
      const iso = new Date(parseInt(builtAt, 10)).toISOString();
      console.log(chalk.greenBright(`[ngrv] read from ${fpath}`));
      console.log(chalk.greenBright(`[ngrv] ${builtAtFile}: ${builtAt} (${iso})`));
    }
  } catch (err: any) {
    console.error(err?.message);
  }

  try {
    const fpath = path.join(folderPath, commitHashFile);
    const commitHash = fs.readFileSync(fpath, 'utf8').trim();
    process.env[commitHashFile] = commitHash;
    envs.NGRV_COMMIT_HASH = commitHash;
    if (!silent) {
      console.log(chalk.greenBright(`[ngrv] read from ${fpath}`));
      console.log(chalk.greenBright(`[ngrv] ${commitHashFile}: ${commitHash}`));
    }
  } catch (err: any) {
    console.error(err?.message);
  }

  return envs;
};
