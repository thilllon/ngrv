import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const cli = resolve("dist/cli.cjs");
const revision = "b".repeat(40);
let temporaryDirectory: string;
let fixture: string;

const runCli = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], {
    cwd: temporaryDirectory,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_ACTIONS: "false",
      GITLAB_CI: "false",
      SOURCE_DATE_EPOCH: undefined,
    },
  });

beforeAll(() => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "ngrv-cli-"));
  fixture = join(temporaryDirectory, "fixture");
  mkdirSync(fixture);
  writeFileSync(
    join(fixture, "package.json"),
    JSON.stringify({ name: "fixture-package", version: "1.2.3" }),
  );
});

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("built CLI", () => {
  it("generates metadata and inspects it as OpenTelemetry attributes", () => {
    const artifact = join(temporaryDirectory, "nested", "build-info.json");
    const generated = runCli(
      "generate",
      "--cwd",
      fixture,
      "--output",
      artifact,
      "--name",
      "demo",
      "--service-version",
      "2.0.0",
      "--revision",
      revision,
      "--no-timestamp",
      "--strict",
    );

    expect(generated.status).toBe(0);
    expect(generated.stderr).toBe("");
    expect(JSON.parse(readFileSync(artifact, "utf8"))).toEqual({
      schemaVersion: 1,
      service: { name: "demo", version: "2.0.0" },
      source: { revision },
      build: {},
    });

    const inspected = runCli("inspect", artifact, "--otel");
    expect(inspected.status).toBe(0);
    expect(inspected.stderr).toBe("");
    expect(JSON.parse(inspected.stdout)).toEqual({
      "service.name": "demo",
      "service.version": "2.0.0",
      "vcs.ref.head.revision": revision,
    });
  });

  it("uses JSON generation as the bare v4 command", () => {
    const result = runCli(
      "--cwd",
      fixture,
      "--revision",
      revision,
      "--no-timestamp",
      "--strict",
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(
      JSON.parse(
        readFileSync(join(temporaryDirectory, "build-info.json"), "utf8"),
      ),
    ).toEqual({
      schemaVersion: 1,
      service: { name: "fixture-package", version: "1.2.3" },
      source: { revision },
      build: {},
    });
  });

  it("only includes custom OTel attributes when inspection opts in", () => {
    const file = join(temporaryDirectory, "custom.json");
    writeFileSync(
      file,
      JSON.stringify({
        schemaVersion: 1,
        service: {},
        source: { revision, dirty: false },
        build: {},
      }),
    );
    const standard = runCli("inspect", file, "--otel");
    const custom = runCli("inspect", file, "--otel", "--include-custom");
    expect(standard.status).toBe(0);
    expect(custom.status).toBe(0);
    expect(JSON.parse(standard.stdout)).toEqual({
      "vcs.ref.head.revision": revision,
    });
    expect(JSON.parse(custom.stdout)).toEqual({
      "vcs.ref.head.revision": revision,
      "ngrv.source.dirty": false,
    });
  });

  it("writes an importable ESM metadata module", () => {
    const artifact = join(temporaryDirectory, "build-info.mjs");
    const generated = runCli(
      "generate",
      "--cwd",
      fixture,
      "--output",
      artifact,
      "--format",
      "esm",
      "--revision",
      revision,
      "--timestamp",
      "2026-09-21T01:02:03Z",
      "--strict",
    );

    expect(generated.status).toBe(0);
    const imported = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import(${JSON.stringify(
          pathToFileURL(artifact).href,
        )}).then(({default: value}) => console.log(JSON.stringify(value)))`,
      ],
      { encoding: "utf8" },
    );
    expect(imported.status).toBe(0);
    expect(JSON.parse(imported.stdout).service.name).toBe("fixture-package");
    expect(JSON.parse(imported.stdout).build.timestampSource).toBe("explicit");
  });

  it.each([
    ["an unsupported format", ["generate", "--format", "yaml"]],
    [
      "missing strict fields",
      ["generate", "--cwd", temporaryDirectory, "--strict"],
    ],
    ["invalid explicit metadata", ["generate", "--revision", "short"]],
  ])("returns a nonzero status for %s", (_description, args) => {
    const result = runCli(...args);

    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
  });

  it("returns a nonzero status for malformed input", () => {
    const artifact = join(temporaryDirectory, "malformed.json");
    writeFileSync(artifact, "{");

    const result = runCli("inspect", artifact);

    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
  });

  it("returns a nonzero status when the output cannot be replaced", () => {
    const outputDirectory = join(temporaryDirectory, "occupied");
    mkdirSync(outputDirectory);

    const result = runCli(
      "generate",
      "--cwd",
      fixture,
      "--output",
      outputDirectory,
      "--revision",
      revision,
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe("");
  });

  it.each(["create", "c", "read", "r"])(
    "rejects the removed legacy %s command without writing an artifact",
    (command) => {
      const directory = join(temporaryDirectory, `removed-${command}`);
      mkdirSync(directory);

      for (const args of [[command], [command, "-d", "."]]) {
        const result = spawnSync(process.execPath, [cli, ...args], {
          cwd: directory,
          encoding: "utf8",
        });

        expect(result.status).not.toBe(0);
        expect(result.stderr).not.toBe("");
      }
      expect(readdirSync(directory)).toEqual([]);
    },
  );
});
