import { afterEach, describe, expect, it } from '@jest/globals';
import { detectResources, ResourceDetector } from '@opentelemetry/resources';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { NgrvError } from '../src/errors';
import { ngrvDetector } from '../src/otel';

const metadata = {
  schemaVersion: 1,
  service: { name: 'payments', version: '4.5.6' },
  source: { revision: 'a'.repeat(40), dirty: false },
  build: {
    timestamp: '2026-09-21T01:02:03.000Z',
    timestampSource: 'explicit',
    url: 'https://ci.example.test/builds/42',
  },
};
const directories: string[] = [];
const fixtureFile = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ngrv-detector-'));
  directories.push(directory);
  return join(directory, 'build info.json');
};

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('ngrvDetector', () => {
  it('reads the packaged artifact lazily through the real OTel detection API', () => {
    const file = fixtureFile();
    const beforeEnvironment = { ...process.env };
    const detector: ResourceDetector = ngrvDetector({ file });
    writeFileSync(file, JSON.stringify(metadata));
    const resource = detectResources({ detectors: [detector] });
    expect(resource.attributes).toEqual({
      'service.name': 'payments',
      'service.version': '4.5.6',
      'vcs.ref.head.revision': 'a'.repeat(40),
      'cicd.pipeline.run.url.full': 'https://ci.example.test/builds/42',
    });
    expect(process.env).toEqual(beforeEnvironment);
  });

  it('accepts file URLs including paths that need URL escaping', () => {
    const file = fixtureFile();
    writeFileSync(file, JSON.stringify(metadata));
    expect(
      ngrvDetector({ file: pathToFileURL(file) }).detect().attributes['vcs.ref.head.revision']
    ).toBe('a'.repeat(40));
  });

  it('only adds custom build attributes when explicitly requested', () => {
    const file = fixtureFile();
    writeFileSync(file, JSON.stringify(metadata));
    expect(ngrvDetector({ file, includeCustomAttributes: true }).detect().attributes).toEqual({
      'service.name': 'payments',
      'service.version': '4.5.6',
      'vcs.ref.head.revision': 'a'.repeat(40),
      'cicd.pipeline.run.url.full': 'https://ci.example.test/builds/42',
      'ngrv.source.dirty': false,
      'ngrv.build.timestamp': '2026-09-21T01:02:03.000Z',
      'ngrv.build.timestamp_source': 'explicit',
    });
  });

  it('resolves its default artifact against the directory at factory creation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ngrv-default-detector-'));
    directories.push(directory);
    writeFileSync(join(directory, 'build-info.json'), JSON.stringify(metadata));
    const originalDirectory = process.cwd();
    let detector: ReturnType<typeof ngrvDetector>;
    try {
      process.chdir(directory);
      detector = ngrvDetector();
    } finally {
      process.chdir(originalDirectory);
    }
    expect(detector.detect().attributes['service.name']).toBe('payments');
  });

  it.each([
    ['missing file', undefined, 'NGRV_READ_ERROR'],
    ['malformed JSON', '{', 'NGRV_READ_ERROR'],
    ['unsupported schema', '{"schemaVersion":99}', 'NGRV_VALIDATION_ERROR'],
  ])('reports %s without falling back to runtime collection', (_name, contents, code) => {
    const file = fixtureFile();
    if (contents !== undefined) writeFileSync(file, contents);
    const detector = ngrvDetector({ file });
    expect(() => detector.detect()).toThrow(NgrvError);
    try {
      detector.detect();
    } catch (error) {
      expect((error as NgrvError).code).toBe(code);
    }
  });
});
