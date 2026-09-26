const assert = require('assert/strict');
const { execFileSync, spawnSync } = require('child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const { basename, join, resolve } = require('path');
const { pathToFileURL } = require('url');

const repository = resolve(__dirname, '..');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'ngrv-package-smoke-'));
const packageDirectory = join(temporaryDirectory, 'package');
const consumerDirectory = join(temporaryDirectory, 'consumer');
const xdgConfigDirectory = join(temporaryDirectory, 'xdg');
mkdirSync(packageDirectory);
mkdirSync(consumerDirectory);
mkdirSync(xdgConfigDirectory);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: consumerDirectory,
    encoding: 'utf8',
    env: { ...process.env, XDG_CONFIG_HOME: xdgConfigDirectory },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${String(result.status)})\n${String(
        result.error ?? ''
      )}\n${String(result.stdout ?? '')}\n${String(result.stderr ?? '')}`
    );
  }
  return result.stdout;
};

try {
  const manifest = require(join(repository, 'package.json'));
  run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', packageDirectory], {
    cwd: repository,
  });
  const archive = join(packageDirectory, `${manifest.name}-${manifest.version}.tgz`);

  writeFileSync(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({
      name: 'ngrv-smoke-consumer',
      version: '1.0.0',
      private: true,
      dependencies: { commander: '9.4.1', ngrv: `file:${archive}` },
    })
  );
  run('pnpm', ['install', '--prefer-offline', '--ignore-scripts', '--no-frozen-lockfile']);

  const commonJs = `
const assert = require('assert/strict');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (['child_process', 'node:child_process', 'os', 'node:os'].includes(request)) throw new Error('ngrv/otel loaded ' + request);
  return originalLoad.apply(this, arguments);
};
const otel = require('ngrv/otel');
assert.deepEqual(otel.toOtelAttributes({ schemaVersion: 1, service: { name: 'cjs' }, source: {}, build: {} }), { 'service.name': 'cjs' });
assert.equal(typeof otel.ngrvDetector, 'function');
Module._load = originalLoad;
const root = require('ngrv');
assert.equal(typeof root.collectBuildInfo, 'function');
assert.equal(typeof root.engrave, 'function');
`;
  writeFileSync(join(consumerDirectory, 'commonjs.cjs'), commonJs);
  run(process.execPath, ['commonjs.cjs']);

  const esm = `
import assert from 'node:assert/strict';
import { collectBuildInfo, engrave } from 'ngrv';
import { toOtelAttributes, ngrvDetector } from 'ngrv/otel';
assert.equal(typeof collectBuildInfo, 'function');
assert.equal(typeof engrave, 'function');
assert.equal(typeof ngrvDetector, 'function');
assert.deepEqual(toOtelAttributes({ schemaVersion: 1, service: { name: 'esm' }, source: {}, build: {} }), { 'service.name': 'esm' });
`;
  writeFileSync(join(consumerDirectory, 'esm.mjs'), esm);
  run(process.execPath, ['esm.mjs']);

  const executableSuffix = process.platform === 'win32' ? '.cmd' : '';
  const binDirectory = join(consumerDirectory, 'node_modules', '.bin');
  const installedPackageDirectory = join(consumerDirectory, 'node_modules', 'ngrv');
  const installedManifest = JSON.parse(
    readFileSync(join(installedPackageDirectory, 'package.json'), 'utf8')
  );
  assert.deepEqual(Object.keys(installedManifest.bin).sort(), [
    'ngrv',
    'ngrv-global',
    'ngrv:global',
  ]);
  for (const target of Object.values(installedManifest.bin)) {
    run(process.execPath, [join(installedPackageDirectory, target), '--help']);
  }

  const artifact = join(consumerDirectory, 'build-info.json');
  run(join(binDirectory, `ngrv${executableSuffix}`), [
    'generate',
    '--cwd',
    consumerDirectory,
    '--output',
    artifact,
    '--revision',
    'c'.repeat(40),
    '--no-timestamp',
    '--strict',
  ]);
  const inspected = JSON.parse(
    run(join(binDirectory, `ngrv${executableSuffix}`), ['inspect', artifact, '--otel'])
  );
  assert.equal(inspected['service.name'], 'ngrv-smoke-consumer');
  assert.equal(inspected['service.version'], '1.0.0');
  assert.equal(inspected['vcs.ref.head.revision'], 'c'.repeat(40));

  run(process.execPath, [
    join(repository, 'scripts/node-sdk-smoke.cjs'),
    join(installedPackageDirectory, 'dist/cli.js'),
    join(installedPackageDirectory, 'dist/otel.js'),
  ]);

  const moduleArtifact = join(consumerDirectory, 'build-info.mjs');
  run(join(binDirectory, `ngrv${executableSuffix}`), [
    'generate',
    '--cwd',
    consumerDirectory,
    '--output',
    moduleArtifact,
    '--format',
    'esm',
    '--revision',
    'd'.repeat(40),
    '--no-timestamp',
    '--strict',
  ]);
  const imported = JSON.parse(
    run(process.execPath, [
      '--input-type=module',
      '--eval',
      `import(${JSON.stringify(
        pathToFileURL(moduleArtifact).href
      )}).then(({default: value}) => console.log(JSON.stringify(value)))`,
    ])
  );
  assert.equal(imported.source.revision, 'd'.repeat(40));

  writeFileSync(
    join(consumerDirectory, 'types.ts'),
    `import { collectBuildInfo, type BuildInfo } from 'ngrv';\nimport { toOtelAttributes, ngrvDetector } from 'ngrv/otel';\nconst info: BuildInfo = collectBuildInfo({ timestamp: false });\ntoOtelAttributes(info);\nngrvDetector({ file: new URL('file:///app/build-info.json') }).detect();\n`
  );
  writeFileSync(
    join(consumerDirectory, 'types.mts'),
    readFileSync(join(consumerDirectory, 'types.ts'))
  );
  execFileSync(
    process.execPath,
    [
      join(repository, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'node16',
      '--moduleResolution',
      'node16',
      '--target',
      'es2020',
      'types.ts',
      'types.mts',
    ],
    { cwd: consumerDirectory, stdio: 'pipe' }
  );

  assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).schemaVersion, 1);
  console.log(`Packed consumer smoke passed: ${basename(archive)}`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
