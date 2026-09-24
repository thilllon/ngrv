import { afterEach, describe, expect, it } from '@jest/globals';
import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';
import {
  BuildInfo,
  NgrvError,
  collectBuildInfo,
  readBuildInfo,
  toOtelAttributes,
  validateBuildInfo,
  writeBuildInfo,
} from '../src';

const temporaryDirectories: string[] = [];

const makeTemporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'ngrv-build-info-'));
  temporaryDirectories.push(directory);
  return directory;
};

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const makeRepository = (
  manifest: unknown = { name: 'fixture', version: '1.2.3' }
): { cwd: string; initialCommit: string } => {
  const cwd = makeTemporaryDirectory();
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(manifest), 'utf8');
  git(cwd, 'init', '--quiet');
  git(cwd, 'config', 'user.email', 'fixture@example.com');
  git(cwd, 'config', 'user.name', 'Fixture');
  git(cwd, 'add', 'package.json');
  git(cwd, 'commit', '--quiet', '-m', 'initial');

  return { cwd, initialCommit: git(cwd, 'rev-parse', 'HEAD') };
};

const makeUnbornRepository = (): string => {
  const cwd = makeTemporaryDirectory();
  git(cwd, 'init', '--quiet');
  writeFileSync(join(cwd, 'package.json'), '{"name":"fixture","version":"1.2.3"}', 'utf8');
  return cwd;
};

const completeInfo: BuildInfo = {
  schemaVersion: 1,
  service: { name: 'fixture', version: '1.2.3' },
  source: { revision: 'a'.repeat(40), dirty: false },
  build: {
    timestamp: '2026-09-21T00:00:00.000Z',
    timestampSource: 'explicit',
    url: 'https://ci.example.test/builds/42',
  },
};

const expectNgrvError = (operation: () => unknown, code: string): void => {
  try {
    operation();
    throw new Error('Expected operation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(NgrvError);
    expect(error).toMatchObject({ code });
  }
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('collectBuildInfo', () => {
  it('collects package identity and the actual clean checkout revision', () => {
    const { cwd, initialCommit } = makeRepository();

    expect(collectBuildInfo({ cwd, env: {}, timestamp: false })).toEqual({
      schemaVersion: 1,
      service: { name: 'fixture', version: '1.2.3' },
      source: { revision: initialCommit, dirty: false },
      build: {},
    });
  });

  it('lets explicit service identity override package.json', () => {
    const { cwd } = makeRepository();

    expect(
      collectBuildInfo({
        cwd,
        env: {},
        name: 'renamed-service',
        version: '9.8.7',
        timestamp: false,
      }).service
    ).toEqual({ name: 'renamed-service', version: '9.8.7' });
  });

  it('prefers an actual checkout revision over a different provider SHA', () => {
    const { cwd, initialCommit } = makeRepository();

    expect(
      collectBuildInfo({
        cwd,
        env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'b'.repeat(40) },
        timestamp: false,
      }).source.revision
    ).toBe(initialCommit);
  });

  it('lets an explicit revision and dirty state override checkout discovery', () => {
    const { cwd } = makeRepository();

    expect(
      collectBuildInfo({
        cwd,
        env: {},
        revision: 'c'.repeat(64),
        dirty: true,
        timestamp: false,
      }).source
    ).toEqual({ revision: 'c'.repeat(64), dirty: true });
  });

  it('reports real checkout edits as dirty', () => {
    const { cwd } = makeRepository();
    writeFileSync(join(cwd, 'untracked.txt'), 'changed', 'utf8');

    expect(collectBuildInfo({ cwd, env: {}, timestamp: false }).source.dirty).toBe(true);
  });

  it('does not refresh or lock the Git index while checking dirty state', () => {
    const { cwd } = makeRepository();
    const manifest = join(cwd, 'package.json');
    const index = join(cwd, '.git', 'index');
    const manifestStat = statSync(manifest);
    const indexBefore = readFileSync(index);
    utimesSync(manifest, manifestStat.atime, new Date(manifestStat.mtimeMs + 10_000));

    collectBuildInfo({ cwd, env: {}, timestamp: false });

    expect(readFileSync(index)).toEqual(indexBefore);
    expect(existsSync(join(cwd, '.git', 'index.lock'))).toBe(false);
  });

  it('keeps dirty state but omits the unavailable revision for an unborn HEAD', () => {
    const cwd = makeUnbornRepository();

    expect(collectBuildInfo({ cwd, env: {}, timestamp: false }).source).toEqual({ dirty: true });
  });

  it('uses explicit and provider revisions when the checkout HEAD is unborn', () => {
    const cwd = makeUnbornRepository();

    expect(
      collectBuildInfo({ cwd, env: {}, revision: '7'.repeat(40), timestamp: false }).source
    ).toEqual({ revision: '7'.repeat(40), dirty: true });
    expect(
      collectBuildInfo({
        cwd,
        env: { GITHUB_ACTIONS: 'true', GITHUB_SHA: '8'.repeat(40) },
        timestamp: false,
      }).source
    ).toEqual({ revision: '8'.repeat(40), dirty: true });
  });

  it('reports a broken HEAD as a collection error', () => {
    const cwd = makeUnbornRepository();
    const headReference = git(cwd, 'symbolic-ref', 'HEAD');
    const referenceFile = join(cwd, '.git', headReference);
    mkdirSync(dirname(referenceFile), { recursive: true });
    writeFileSync(referenceFile, 'a'.repeat(40), 'utf8');

    expectNgrvError(
      () => collectBuildInfo({ cwd, env: {}, timestamp: false }),
      'NGRV_COLLECTION_ERROR'
    );
  });

  it('does not mutate files or the supplied environment', () => {
    const { cwd } = makeRepository();
    const env = { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'd'.repeat(40), PRIVATE_TOKEN: 'secret' };
    const originalEnvironment = { ...env };
    const originalProcessEnvironment = { ...process.env };
    const beforeEntries = readdirSync(cwd).sort();
    const beforeManifest = readFileSync(join(cwd, 'package.json'), 'utf8');

    collectBuildInfo({ cwd, env, timestamp: false });

    expect(env).toEqual(originalEnvironment);
    expect(process.env).toEqual(originalProcessEnvironment);
    expect(readdirSync(cwd).sort()).toEqual(beforeEntries);
    expect(readFileSync(join(cwd, 'package.json'), 'utf8')).toBe(beforeManifest);
  });

  it('omits unknown source state when the directory is not a Git checkout', () => {
    const cwd = makeTemporaryDirectory();
    writeFileSync(join(cwd, 'package.json'), '{"name":"fixture","version":"1.2.3"}', 'utf8');

    expect(collectBuildInfo({ cwd, env: {}, timestamp: false }).source).toEqual({});
  });

  it('uses a GitHub revision and build URL only with the GitHub Actions marker', () => {
    const cwd = makeTemporaryDirectory();
    const providerEnvironment = {
      GITHUB_ACTIONS: 'true',
      GITHUB_SHA: 'e'.repeat(40),
      GITHUB_SERVER_URL: 'https://github.example.test',
      GITHUB_REPOSITORY: 'owner/repository',
      GITHUB_RUN_ID: '1234',
    };

    expect(collectBuildInfo({ cwd, env: providerEnvironment, timestamp: false })).toEqual({
      schemaVersion: 1,
      service: {},
      source: { revision: 'e'.repeat(40) },
      build: { url: 'https://github.example.test/owner/repository/actions/runs/1234' },
    });
    expect(
      collectBuildInfo({
        cwd,
        env: { ...providerEnvironment, GITHUB_ACTIONS: 'false' },
        timestamp: false,
      })
    ).toEqual({ schemaVersion: 1, service: {}, source: {}, build: {} });
  });

  it('uses a GitLab revision and pipeline URL only with the GitLab CI marker', () => {
    const cwd = makeTemporaryDirectory();
    const providerEnvironment = {
      GITLAB_CI: 'true',
      CI_COMMIT_SHA: 'f'.repeat(64),
      CI_PIPELINE_URL: 'https://gitlab.example.test/owner/repository/-/pipelines/42',
    };

    expect(collectBuildInfo({ cwd, env: providerEnvironment, timestamp: false })).toEqual({
      schemaVersion: 1,
      service: {},
      source: { revision: 'f'.repeat(64) },
      build: { url: 'https://gitlab.example.test/owner/repository/-/pipelines/42' },
    });
    expect(
      collectBuildInfo({
        cwd,
        env: { ...providerEnvironment, GITLAB_CI: 'false' },
        timestamp: false,
      })
    ).toEqual({ schemaVersion: 1, service: {}, source: {}, build: {} });
  });

  it('uses source date epoch zero as a reproducible UTC timestamp', () => {
    const cwd = makeTemporaryDirectory();

    expect(collectBuildInfo({ cwd, env: { SOURCE_DATE_EPOCH: '0' } }).build).toEqual({
      timestamp: '1970-01-01T00:00:00.000Z',
      timestampSource: 'source-date-epoch',
    });
  });

  it('gives an explicit timestamp precedence over source date epoch', () => {
    const cwd = makeTemporaryDirectory();

    expect(
      collectBuildInfo({
        cwd,
        env: { SOURCE_DATE_EPOCH: '0' },
        timestamp: '2026-09-21T12:34:56.000Z',
      }).build
    ).toEqual({ timestamp: '2026-09-21T12:34:56.000Z', timestampSource: 'explicit' });
  });

  it('accepts an ISO offset without fractional seconds and normalizes it to UTC', () => {
    const cwd = makeTemporaryDirectory();

    expect(
      collectBuildInfo({ cwd, env: {}, timestamp: '2026-09-21T21:34:56+09:00' }).build
    ).toEqual({ timestamp: '2026-09-21T12:34:56.000Z', timestampSource: 'explicit' });
  });

  it('uses the collection clock by default', () => {
    const cwd = makeTemporaryDirectory();
    const earliest = Date.now();

    const info = collectBuildInfo({ cwd, env: {} });

    const latest = Date.now();
    expect(info.build.timestampSource).toBe('clock');
    expect(Date.parse(info.build.timestamp as string)).toBeGreaterThanOrEqual(earliest);
    expect(Date.parse(info.build.timestamp as string)).toBeLessThanOrEqual(latest);
  });

  it('omits both timestamp fields when timestamp is false', () => {
    const cwd = makeTemporaryDirectory();

    expect(
      collectBuildInfo({ cwd, env: { SOURCE_DATE_EPOCH: '123' }, timestamp: false }).build
    ).toEqual({});
  });

  it.each(['not-a-date', '2026-02-30T00:00:00.000Z'])(
    'rejects invalid explicit date %s',
    (timestamp) => {
      const cwd = makeTemporaryDirectory();

      expectNgrvError(() => collectBuildInfo({ cwd, env: {}, timestamp }), 'NGRV_COLLECTION_ERROR');
    }
  );

  it.each(['-1', '1.5', 'not-seconds', '999999999999999999999999'])(
    'rejects invalid SOURCE_DATE_EPOCH %s',
    (sourceDateEpoch) => {
      const cwd = makeTemporaryDirectory();

      expectNgrvError(
        () => collectBuildInfo({ cwd, env: { SOURCE_DATE_EPOCH: sourceDateEpoch } }),
        'NGRV_COLLECTION_ERROR'
      );
    }
  );

  it('rejects malformed package.json rather than silently omitting identity', () => {
    const cwd = makeTemporaryDirectory();
    writeFileSync(join(cwd, 'package.json'), '{ definitely not json', 'utf8');

    expectNgrvError(
      () => collectBuildInfo({ cwd, env: {}, timestamp: false }),
      'NGRV_COLLECTION_ERROR'
    );
  });

  it('requires name, version, and revision in strict mode', () => {
    const cwd = makeTemporaryDirectory();

    expectNgrvError(
      () => collectBuildInfo({ cwd, env: {}, strict: true, timestamp: false }),
      'NGRV_COLLECTION_ERROR'
    );
  });
});

describe('BuildInfo validation and storage', () => {
  it('accepts SHA-1 and SHA-256 revisions', () => {
    expect(
      validateBuildInfo({ ...completeInfo, source: { revision: '1'.repeat(40), dirty: false } })
        .source.revision
    ).toBe('1'.repeat(40));
    expect(
      validateBuildInfo({ ...completeInfo, source: { revision: '2'.repeat(64), dirty: false } })
        .source.revision
    ).toBe('2'.repeat(64));
  });

  it.each([
    ['2026-09-21T12:34:56Z', '2026-09-21T12:34:56.000Z'],
    ['2026-09-21T21:34:56+09:00', '2026-09-21T12:34:56.000Z'],
  ])('normalizes valid ISO timestamp %s', (timestamp, expected) => {
    expect(
      validateBuildInfo({
        ...completeInfo,
        build: { ...completeInfo.build, timestamp },
      }).build.timestamp
    ).toBe(expected);
  });

  it.each([
    ['missing schema', {}],
    ['unsupported schema', { ...completeInfo, schemaVersion: 2 }],
    ['non-object service', { ...completeInfo, service: 'fixture' }],
    ['short revision', { ...completeInfo, source: { revision: 'abc' } }],
    ['non-boolean dirty', { ...completeInfo, source: { dirty: 'false' } }],
    [
      'invalid timestamp',
      { ...completeInfo, build: { timestamp: 'not-a-date', timestampSource: 'explicit' } },
    ],
    [
      'impossible calendar date',
      {
        ...completeInfo,
        build: { timestamp: '2026-02-30T00:00:00Z', timestampSource: 'explicit' },
      },
    ],
    [
      'timestamp without source',
      { ...completeInfo, build: { timestamp: '2026-09-21T00:00:00.000Z' } },
    ],
    ['source without timestamp', { ...completeInfo, build: { timestampSource: 'clock' } }],
    ['non-HTTP URL', { ...completeInfo, build: { url: 'ftp://example.test/build' } }],
    [
      'credentialed URL',
      { ...completeInfo, build: { url: 'https://user:password@example.test/build' } },
    ],
  ])('rejects malformed metadata: %s', (_caseName, value) => {
    expectNgrvError(() => validateBuildInfo(value), 'NGRV_VALIDATION_ERROR');
  });

  it('round-trips validated JSON metadata', () => {
    const directory = makeTemporaryDirectory();
    const file = join(directory, 'nested', 'metadata.json');

    expect(writeBuildInfo(completeInfo, { file })).toBe(file);
    expect(readBuildInfo(file)).toEqual(completeInfo);
    expect(readdirSync(dirname(file)).sort()).toEqual(['metadata.json']);
  });

  it('writes an importable ESM module with default and named exports', () => {
    const directory = makeTemporaryDirectory();
    const file = join(directory, 'metadata.mjs');
    writeBuildInfo(completeInfo, { file, format: 'esm' });

    const script = [
      `import buildInfo, { buildInfo as named } from ${JSON.stringify(pathToFileURL(file).href)};`,
      'process.stdout.write(JSON.stringify({ buildInfo, named }));',
    ].join('\n');
    const imported = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
        encoding: 'utf8',
      })
    );

    expect(imported).toEqual({ buildInfo: completeInfo, named: completeInfo });
  });

  it('serializes only known fields', () => {
    const directory = makeTemporaryDirectory();
    const file = join(directory, 'metadata.json');
    const unsafe = {
      ...completeInfo,
      username: 'alice',
      home: '/home/alice',
      environment: { PRIVATE_TOKEN: 'secret' },
      service: { ...completeInfo.service, password: 'secret' },
      source: { ...completeInfo.source, remote: 'https://token@example.test/repository' },
      build: { ...completeInfo.build, host: 'builder.internal' },
    } as BuildInfo;

    writeBuildInfo(unsafe, { file });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(completeInfo);
  });

  it('reports write failures with a stable code and leaves no artifact', () => {
    const directory = makeTemporaryDirectory();
    const blockingFile = join(directory, 'blocking-file');
    const output = join(blockingFile, 'metadata.json');
    writeFileSync(blockingFile, 'not a directory', 'utf8');

    expectNgrvError(() => writeBuildInfo(completeInfo, { file: output }), 'NGRV_WRITE_ERROR');
    expect(existsSync(output)).toBe(false);
  });

  it('reports a missing metadata file with a stable read code', () => {
    const file = join(makeTemporaryDirectory(), 'missing.json');

    expectNgrvError(() => readBuildInfo(file), 'NGRV_READ_ERROR');
  });

  it('reports corrupt JSON with a stable read code', () => {
    const file = join(makeTemporaryDirectory(), 'metadata.json');
    writeFileSync(file, '{ broken json', 'utf8');

    expectNgrvError(() => readBuildInfo(file), 'NGRV_READ_ERROR');
  });
});

describe('toOtelAttributes', () => {
  it('maps standard attributes without exposing custom metadata by default', () => {
    expect(toOtelAttributes(completeInfo)).toEqual({
      'service.name': 'fixture',
      'service.version': '1.2.3',
      'vcs.ref.head.revision': 'a'.repeat(40),
      'cicd.pipeline.run.url.full': 'https://ci.example.test/builds/42',
    });
  });

  it('preserves false and includes extra build fields when requested', () => {
    expect(toOtelAttributes(completeInfo, { includeCustomAttributes: true })).toEqual({
      'service.name': 'fixture',
      'service.version': '1.2.3',
      'vcs.ref.head.revision': 'a'.repeat(40),
      'ngrv.source.dirty': false,
      'ngrv.build.timestamp': '2026-09-21T00:00:00.000Z',
      'ngrv.build.timestamp_source': 'explicit',
      'cicd.pipeline.run.url.full': 'https://ci.example.test/builds/42',
    });
  });

  it('omits undefined and unrecognized fields', () => {
    const minimal = {
      schemaVersion: 1,
      service: { name: 'fixture', secret: 'hidden' },
      source: {},
      build: {},
      username: 'alice',
    } as unknown as BuildInfo;

    expect(toOtelAttributes(minimal)).toEqual({ 'service.name': 'fixture' });
  });

  it('validates metadata before converting it', () => {
    expectNgrvError(
      () => toOtelAttributes({ ...completeInfo, source: { revision: 'not-a-commit' } }),
      'NGRV_VALIDATION_ERROR'
    );
  });
});
