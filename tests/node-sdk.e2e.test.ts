import { expect, it } from '@jest/globals';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

it('carries the build CLI artifact into real NodeSDK exported spans after packaging', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/node-sdk-smoke.cjs')], {
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('NodeSDK smoke passed');
});
