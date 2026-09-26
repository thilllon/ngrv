import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { BuildInfo, validateBuildInfo } from './build-info';
import { NgrvError } from './errors';

export interface WriteBuildInfoOptions {
  file?: string;
  format?: 'json' | 'esm';
}

const jsonSource = (info: BuildInfo): string => `${JSON.stringify(info, null, 2)}\n`;

export const writeBuildInfo = (value: BuildInfo, options: WriteBuildInfoOptions = {}): string => {
  const info = validateBuildInfo(value);
  const format = options.format ?? 'json';
  const file = resolve(options.file ?? (format === 'esm' ? 'build-info.mjs' : 'build-info.json'));
  const directory = dirname(file);
  const temporaryFile = `${file}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  const source =
    format === 'esm'
      ? `const buildInfo = ${JSON.stringify(
          info,
          null,
          2
        )};\n\nexport { buildInfo };\nexport default buildInfo;\n`
      : jsonSource(info);

  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporaryFile, source, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporaryFile, file);
    return file;
  } catch (error) {
    if (existsSync(temporaryFile)) {
      try {
        unlinkSync(temporaryFile);
      } catch {
        // Preserve the original write failure.
      }
    }
    throw new NgrvError('NGRV_WRITE_ERROR', `Unable to write build metadata to ${file}`, error);
  }
};

export const readBuildInfo = (file = 'build-info.json'): BuildInfo => {
  const resolvedFile = resolve(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolvedFile, 'utf8'));
  } catch (error) {
    throw new NgrvError(
      'NGRV_READ_ERROR',
      `Unable to read build metadata from ${resolvedFile}`,
      error
    );
  }
  return validateBuildInfo(parsed);
};
