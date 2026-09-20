import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { BuildInfo, validateBuildInfo } from './build-info';
import { NgrvError } from './errors';

export interface CollectBuildInfoOptions {
  cwd?: string;
  env?: Readonly<Record<string, string | undefined>>;
  name?: string;
  version?: string;
  revision?: string;
  dirty?: boolean;
  buildUrl?: string;
  timestamp?: string | false;
  strict?: boolean;
}

interface PackageIdentity {
  name?: string;
  version?: string;
}

interface GitIdentity {
  revision?: string;
  dirty?: boolean;
}

interface ProviderIdentity {
  revision?: string;
  buildUrl?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const collectError = (message: string, cause?: unknown): NgrvError =>
  new NgrvError('NGRV_COLLECTION_ERROR', message, cause);

const readPackageIdentity = (cwd: string): PackageIdentity => {
  const manifestFile = join(cwd, 'package.json');
  let source: string;
  try {
    source = readFileSync(manifestFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw collectError(`Unable to read ${manifestFile}`, error);
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    throw collectError(`Unable to parse ${manifestFile}`, error);
  }
  if (!isRecord(manifest)) throw collectError(`${manifestFile} must contain a JSON object`);

  const identity: PackageIdentity = {};
  for (const key of ['name', 'version'] as const) {
    const value = manifest[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length === 0) {
      throw collectError(`${manifestFile} field ${key} must be a non-empty string`);
    }
    identity[key] = value;
  }
  return identity;
};

const runGit = (cwd: string, args: string[]): string =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const readGitIdentity = (cwd: string): GitIdentity => {
  try {
    if (runGit(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return {};
  } catch {
    return {};
  }

  try {
    return {
      revision: runGit(cwd, ['rev-parse', 'HEAD']),
      dirty: runGit(cwd, ['status', '--porcelain']).length > 0,
    };
  } catch (error) {
    throw collectError('Unable to inspect the Git checkout', error);
  }
};

const readProviderIdentity = (
  env: Readonly<Record<string, string | undefined>>
): ProviderIdentity => {
  if (env.GITHUB_ACTIONS === 'true') {
    const server = env.GITHUB_SERVER_URL;
    const repository = env.GITHUB_REPOSITORY;
    const runId = env.GITHUB_RUN_ID;
    return {
      ...(env.GITHUB_SHA === undefined ? {} : { revision: env.GITHUB_SHA }),
      ...(server && repository && runId
        ? { buildUrl: `${server.replace(/\/$/, '')}/${repository}/actions/runs/${runId}` }
        : {}),
    };
  }

  if (env.GITLAB_CI === 'true') {
    return {
      ...(env.CI_COMMIT_SHA === undefined ? {} : { revision: env.CI_COMMIT_SHA }),
      ...(env.CI_PIPELINE_URL === undefined ? {} : { buildUrl: env.CI_PIPELINE_URL }),
    };
  }

  return {};
};

const canonicalExplicitTimestamp = (value: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw collectError('timestamp must be a valid ISO timestamp');
  }
  return value;
};

const timestampFromEpoch = (value: string): string => {
  if (!/^\d+$/.test(value)) throw collectError('SOURCE_DATE_EPOCH must be UTC Unix seconds');
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds)) {
    throw collectError('SOURCE_DATE_EPOCH must be UTC Unix seconds');
  }
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) {
    throw collectError('SOURCE_DATE_EPOCH must be UTC Unix seconds');
  }
  return date.toISOString();
};

export const collectBuildInfo = (options: CollectBuildInfoOptions = {}): BuildInfo => {
  try {
    const cwd = resolve(options.cwd ?? process.cwd());
    const env = options.env ?? process.env;
    const packageIdentity = readPackageIdentity(cwd);
    const gitIdentity = readGitIdentity(cwd);
    const providerIdentity = readProviderIdentity(env);
    const name = options.name ?? packageIdentity.name;
    const version = options.version ?? packageIdentity.version;
    const revision = options.revision ?? gitIdentity.revision ?? providerIdentity.revision;
    const dirty = options.dirty ?? gitIdentity.dirty;
    const buildUrl = options.buildUrl ?? providerIdentity.buildUrl;

    const build: BuildInfo['build'] = {
      ...(buildUrl === undefined ? {} : { url: buildUrl }),
    };
    if (options.timestamp !== false) {
      if (typeof options.timestamp === 'string') {
        build.timestamp = canonicalExplicitTimestamp(options.timestamp);
        build.timestampSource = 'explicit';
      } else if (env.SOURCE_DATE_EPOCH !== undefined) {
        build.timestamp = timestampFromEpoch(env.SOURCE_DATE_EPOCH);
        build.timestampSource = 'source-date-epoch';
      } else {
        build.timestamp = new Date().toISOString();
        build.timestampSource = 'clock';
      }
    }

    const info = validateBuildInfo({
      schemaVersion: 1,
      service: {
        ...(name === undefined ? {} : { name }),
        ...(version === undefined ? {} : { version }),
      },
      source: {
        ...(revision === undefined ? {} : { revision }),
        ...(dirty === undefined ? {} : { dirty }),
      },
      build,
    });

    if (options.strict && (!info.service.name || !info.service.version || !info.source.revision)) {
      throw collectError('Strict mode requires service name, service version, and source revision');
    }
    return info;
  } catch (error) {
    if (error instanceof NgrvError && error.code === 'NGRV_COLLECTION_ERROR') throw error;
    throw collectError('Unable to collect build metadata', error);
  }
};
