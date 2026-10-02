import assert from "node:assert/strict";
import {
  execFileSync,
  spawnSync,
  type SpawnSyncOptionsWithStringEncoding,
} from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repository = resolve(__dirname, "..");
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "birthplace-package-smoke-"),
);
const packageDirectory = join(temporaryDirectory, "package");
const consumerDirectory = join(temporaryDirectory, "consumer");
const xdgConfigDirectory = join(temporaryDirectory, "xdg");
mkdirSync(packageDirectory);
mkdirSync(consumerDirectory);
mkdirSync(xdgConfigDirectory);

const run = (
  command: string,
  args: string[],
  options: Partial<SpawnSyncOptionsWithStringEncoding> = {},
): string => {
  const result = spawnSync(command, args, {
    cwd: consumerDirectory,
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: xdgConfigDirectory },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${String(result.status)})\n${String(
        result.error ?? "",
      )}\n${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}`,
    );
  }
  return result.stdout;
};

try {
  const manifest = require(join(repository, "package.json"));
  run(
    "pnpm",
    [
      "--config.ignore-scripts=true",
      "pack",
      "--pack-destination",
      packageDirectory,
    ],
    {
      cwd: repository,
    },
  );
  const archive = join(
    packageDirectory,
    `${manifest.name}-${manifest.version}.tgz`,
  );

  writeFileSync(
    join(consumerDirectory, "package.json"),
    JSON.stringify({
      name: "birthplace-smoke-consumer",
      version: "1.0.0",
      private: true,
      dependencies: {
        commander: JSON.parse(
          readFileSync(
            join(repository, "node_modules/commander/package.json"),
            "utf8",
          ),
        ).version,
        birthplace: `file:${archive}`,
      },
    }),
  );
  run("pnpm", [
    "install",
    "--prefer-offline",
    "--ignore-scripts",
    "--no-frozen-lockfile",
  ]);

  const commonJs = `
const assert = require('assert/strict');
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (['child_process', 'node:child_process', 'os', 'node:os'].includes(request)) throw new Error('birthplace/otel loaded ' + request);
  return originalLoad.apply(this, arguments);
};
const otel = require('birthplace/otel');
assert.deepEqual(otel.toOtelAttributes({ schemaVersion: 1, service: { name: 'cjs' }, source: {}, build: {} }), { 'service.name': 'cjs' });
assert.equal(typeof otel.birthplaceDetector, 'function');
Module._load = function (request, parent, isMain) {
  if (request.startsWith('node:') || Module.builtinModules.includes(request)) throw new Error('birthplace/attributes loaded ' + request);
  return originalLoad.apply(this, arguments);
};
const attributes = require('birthplace/attributes');
assert.deepEqual(attributes.toOtelAttributes({ schemaVersion: 1, service: { name: 'cjs' }, source: {}, build: {} }), { 'service.name': 'cjs' });
assert.deepEqual(Object.keys(attributes).sort(), ['BirthplaceError', 'toOtelAttributes']);
Module._load = originalLoad;
assert.deepEqual(otel.birthplaceDetector({ info: { schemaVersion: 1, service: { name: 'object' }, source: {}, build: {} } }).detect().attributes, { 'service.name': 'object' });
const root = require('birthplace');
assert.equal(typeof root.collectBirthplace, 'function');
assert.equal(root.validateBirthplace, undefined);
assert.equal(otel.validateBirthplace, undefined);
assert.equal(root.engrave, undefined);
assert.equal(root.readEngrave, undefined);
`;
  writeFileSync(join(consumerDirectory, "commonjs.cjs"), commonJs);
  run(process.execPath, ["commonjs.cjs"]);

  const esm = `
import assert from 'node:assert/strict';
import * as root from 'birthplace';
import { collectBirthplace } from 'birthplace';
import { toOtelAttributes, birthplaceDetector } from 'birthplace/otel';
import * as attributes from 'birthplace/attributes';
assert.deepEqual(Object.keys(attributes).sort(), ['BirthplaceError', 'toOtelAttributes']);
assert.deepEqual(attributes.toOtelAttributes({ schemaVersion: 1, service: { name: 'esm' }, source: {}, build: {} }), { 'service.name': 'esm' });
assert.equal(typeof collectBirthplace, 'function');
assert.equal('validateBirthplace' in root, false);
assert.equal('engrave' in root, false);
assert.equal('readEngrave' in root, false);
assert.equal(typeof birthplaceDetector, 'function');
assert.deepEqual(toOtelAttributes({ schemaVersion: 1, service: { name: 'esm' }, source: {}, build: {} }), { 'service.name': 'esm' });
`;
  writeFileSync(join(consumerDirectory, "esm.mjs"), esm);
  run(process.execPath, ["esm.mjs"]);

  const executableSuffix = process.platform === "win32" ? ".cmd" : "";
  const binDirectory = join(consumerDirectory, "node_modules", ".bin");
  const installedPackageDirectory = join(
    consumerDirectory,
    "node_modules",
    "birthplace",
  );
  const installedManifest = JSON.parse(
    readFileSync(join(installedPackageDirectory, "package.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(installedManifest.bin), ["birthplace"]);
  for (const target of Object.values(
    installedManifest.bin as Record<string, string>,
  )) {
    run(process.execPath, [join(installedPackageDirectory, target), "--help"]);
  }

  // birthplace/attributes must stay usable without Node.js built-ins: walk the built
  // import graph of both formats and reject anything that is not a relative module.
  const builtinFreeGraph = (entry: string): string[] => {
    const visited = new Set<string>();
    const pending = [join(installedPackageDirectory, entry)];
    for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
      if (visited.has(file)) {
        continue;
      }
      visited.add(file);
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /node:/, `${file} mentions node:`);
      const specifiers = [
        ...source.matchAll(
          /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])([^"']+)\1/g,
        ),
      ].map((match) => match[2]);
      for (const specifier of specifiers) {
        assert.match(
          specifier,
          /^\.\.?\//,
          `${file} imports the non-relative module ${specifier}`,
        );
        pending.push(resolve(dirname(file), specifier));
      }
    }
    return [...visited];
  };
  for (const entry of ["dist/attributes.mjs", "dist/attributes.cjs"]) {
    assert.ok(builtinFreeGraph(entry).length >= 1);
  }
  // The same walker must notice the built-ins that the Node-only entry does load.
  assert.throws(() => builtinFreeGraph("dist/otel.mjs"), /node:/);
  assert.throws(() => builtinFreeGraph("dist/otel.cjs"), /node:/);

  const birthplaceFile = join(consumerDirectory, "birthplace.json");
  run(join(binDirectory, `birthplace${executableSuffix}`), [
    "generate",
    "--cwd",
    consumerDirectory,
    "--output",
    birthplaceFile,
    "--revision",
    "c".repeat(40),
    "--no-timestamp",
    "--strict",
  ]);
  const inspected = JSON.parse(
    run(join(binDirectory, `birthplace${executableSuffix}`), [
      "inspect",
      birthplaceFile,
      "--otel",
    ]),
  );
  assert.equal(inspected["service.name"], "birthplace-smoke-consumer");
  assert.equal(inspected["service.version"], "1.0.0");
  assert.equal(inspected["vcs.ref.head.revision"], "c".repeat(40));

  run(process.execPath, [
    "--import",
    import.meta.resolve("tsx"),
    join(repository, "scripts/node-sdk-smoke.mts"),
    join(installedPackageDirectory, "dist/cli.cjs"),
    join(installedPackageDirectory, "dist/otel.cjs"),
  ]);
  run(process.execPath, [
    "--import",
    import.meta.resolve("tsx"),
    join(repository, "scripts/node-sdk-smoke.mts"),
    join(installedPackageDirectory, "dist/cli.cjs"),
    join(installedPackageDirectory, "dist/otel.cjs"),
    "--info",
  ]);

  const moduleFile = join(consumerDirectory, "birthplace.mjs");
  run(join(binDirectory, `birthplace${executableSuffix}`), [
    "generate",
    "--cwd",
    consumerDirectory,
    "--output",
    moduleFile,
    "--format",
    "esm",
    "--revision",
    "d".repeat(40),
    "--no-timestamp",
    "--strict",
  ]);
  const imported = JSON.parse(
    run(process.execPath, [
      "--input-type=module",
      "--eval",
      `import(${JSON.stringify(
        pathToFileURL(moduleFile).href,
      )}).then((namespace) => console.log(JSON.stringify({ keys: Object.keys(namespace), value: namespace.default })))`,
    ]),
  );
  assert.deepEqual(imported.keys, ["default"]);
  assert.equal(imported.value.source.revision, "d".repeat(40));

  writeFileSync(
    join(consumerDirectory, "types.ts"),
    `import { collectBirthplace, type Birthplace } from 'birthplace';\nimport { toOtelAttributes, birthplaceDetector } from 'birthplace/otel';\nconst info: Birthplace = collectBirthplace({ timestamp: false });\ntoOtelAttributes(info);\nbirthplaceDetector({ file: new URL('file:///app/birthplace.json') }).detect();\nbirthplaceDetector({ info }).detect();\nimport { toOtelAttributes as map, BirthplaceError, type Birthplace as Info, type OtelAttributes } from 'birthplace/attributes';\nconst mapped: OtelAttributes = map(info as Info);\nvoid [mapped, BirthplaceError];\n`,
  );
  writeFileSync(
    join(consumerDirectory, "types.mts"),
    readFileSync(join(consumerDirectory, "types.ts")),
  );
  execFileSync(
    process.execPath,
    [
      join(repository, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "--strict",
      "--module",
      "node16",
      "--moduleResolution",
      "node16",
      "--target",
      "es2020",
      "types.ts",
      "types.mts",
    ],
    { cwd: consumerDirectory, stdio: "pipe" },
  );

  // The documented TypeScript path: import the generated ESM birthplace file with `allowJs` and
  // pass it on without a cast. The file's JSDoc annotation is what makes this compile.
  writeFileSync(
    join(consumerDirectory, "imported.mts"),
    `import { toOtelAttributes, birthplaceDetector } from 'birthplace/otel';\nimport { toOtelAttributes as map } from 'birthplace/attributes';\nimport type { Birthplace } from 'birthplace';\nimport birthplace from './birthplace.mjs';\nconst typed: Birthplace = birthplace;\nbirthplaceDetector({ info: birthplace }).detect();\nvoid [toOtelAttributes(birthplace), map(birthplace), typed];\n`,
  );
  execFileSync(
    process.execPath,
    [
      join(repository, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "--strict",
      "--allowJs",
      "--module",
      "node16",
      "--moduleResolution",
      "node16",
      "--target",
      "es2020",
      "imported.mts",
    ],
    { cwd: consumerDirectory, stdio: "pipe" },
  );

  assert.equal(
    JSON.parse(readFileSync(birthplaceFile, "utf8")).schemaVersion,
    1,
  );
  console.log(`Packed consumer smoke passed: ${basename(archive)}`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
