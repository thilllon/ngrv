import { afterEach, describe, expect, it } from "vitest";
import { detectResources, ResourceDetector } from "@opentelemetry/resources";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BirthplaceError } from "../src/errors";
import type { Birthplace } from "../src/birthplace";
import { birthplaceDetector } from "../src/otel";

const metadata: Birthplace = {
  schemaVersion: 1,
  service: { name: "payments", version: "4.5.6" },
  source: { revision: "a".repeat(40), dirty: false },
  build: {
    timestamp: "2026-09-21T01:02:03.000Z",
    timestampSource: "explicit",
    url: "https://ci.example.test/builds/42",
  },
};
const directories: string[] = [];
const fixtureFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "birthplace-detector-"));
  directories.push(directory);
  return join(directory, "birthplace file.json");
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("birthplaceDetector", () => {
  it("reads the packaged birthplace file lazily through the real OTel detection API", () => {
    const file = fixtureFile();
    const beforeEnvironment = { ...process.env };
    const detector: ResourceDetector = birthplaceDetector({ file });
    writeFileSync(file, JSON.stringify(metadata));
    const resource = detectResources({ detectors: [detector] });
    expect(resource.attributes).toEqual({
      "service.name": "payments",
      "service.version": "4.5.6",
      "vcs.ref.head.revision": "a".repeat(40),
      "cicd.pipeline.run.url.full": "https://ci.example.test/builds/42",
    });
    expect(process.env).toEqual(beforeEnvironment);
  });

  it("accepts file URLs including paths that need URL escaping", () => {
    const file = fixtureFile();
    writeFileSync(file, JSON.stringify(metadata));
    expect(
      birthplaceDetector({ file: pathToFileURL(file) }).detect().attributes[
        "vcs.ref.head.revision"
      ],
    ).toBe("a".repeat(40));
  });

  it("only adds custom build attributes when explicitly requested", () => {
    const file = fixtureFile();
    writeFileSync(file, JSON.stringify(metadata));
    expect(
      birthplaceDetector({ file, includeCustomAttributes: true }).detect()
        .attributes,
    ).toEqual({
      "service.name": "payments",
      "service.version": "4.5.6",
      "vcs.ref.head.revision": "a".repeat(40),
      "cicd.pipeline.run.url.full": "https://ci.example.test/builds/42",
      "birthplace.source.dirty": false,
      "birthplace.build.timestamp": "2026-09-21T01:02:03.000Z",
      "birthplace.build.timestamp_source": "explicit",
    });
  });

  it("only adds build machine attributes when explicitly requested", () => {
    const file = fixtureFile();
    writeFileSync(
      file,
      JSON.stringify({
        ...metadata,
        host: {
          arch: "amd64",
          cpu: { model: { name: "Fixture CPU" }, logical: { count: 4 } },
          memory: { total: 8_589_934_592 },
          endianness: "little",
        },
      }),
    );
    const standard = {
      "service.name": "payments",
      "service.version": "4.5.6",
      "vcs.ref.head.revision": "a".repeat(40),
      "cicd.pipeline.run.url.full": "https://ci.example.test/builds/42",
    };

    expect(birthplaceDetector({ file }).detect().attributes).toEqual(standard);
    const detector: ResourceDetector = birthplaceDetector({
      file,
      includeHostAttributes: true,
    });
    expect(detectResources({ detectors: [detector] }).attributes).toEqual({
      ...standard,
      "birthplace.host.arch": "amd64",
      "birthplace.host.cpu.model.name": "Fixture CPU",
      "birthplace.host.cpu.logical.count": 4,
      "birthplace.host.memory.total": 8_589_934_592,
      "birthplace.host.endianness": "little",
    });
  });

  it("resolves its default birthplace file against the directory at factory creation", () => {
    const directory = mkdtempSync(
      join(tmpdir(), "birthplace-default-detector-"),
    );
    directories.push(directory);
    writeFileSync(join(directory, "birthplace.json"), JSON.stringify(metadata));
    const originalDirectory = process.cwd();
    let detector: ReturnType<typeof birthplaceDetector>;
    try {
      process.chdir(directory);
      detector = birthplaceDetector();
    } finally {
      process.chdir(originalDirectory);
    }
    expect(detector.detect().attributes["service.name"]).toBe("payments");
  });

  it("maps an already-loaded object without any birthplace file on disk", () => {
    const directory = mkdtempSync(join(tmpdir(), "birthplace-info-detector-"));
    directories.push(directory);
    const originalDirectory = process.cwd();
    try {
      // No birthplace.json exists here, so a file read would fail.
      process.chdir(directory);
      const detector: ResourceDetector = birthplaceDetector({ info: metadata });
      expect(detectResources({ detectors: [detector] }).attributes).toEqual({
        "service.name": "payments",
        "service.version": "4.5.6",
        "vcs.ref.head.revision": "a".repeat(40),
        "cicd.pipeline.run.url.full": "https://ci.example.test/builds/42",
      });
      expect(readdirSync(directory)).toEqual([]);
    } finally {
      process.chdir(originalDirectory);
    }
  });

  it("honors includeCustomAttributes for an already-loaded object", () => {
    expect(
      birthplaceDetector({
        info: metadata,
        includeCustomAttributes: true,
      }).detect().attributes,
    ).toMatchObject({
      "service.name": "payments",
      "birthplace.source.dirty": false,
      "birthplace.build.timestamp": "2026-09-21T01:02:03.000Z",
      "birthplace.build.timestamp_source": "explicit",
    });
  });

  it("honors includeHostAttributes for an already-loaded object", () => {
    const info: Birthplace = {
      ...metadata,
      host: { arch: "arm64", memory: { total: 17_179_869_184 } },
    };
    expect(birthplaceDetector({ info }).detect().attributes).not.toHaveProperty(
      "birthplace.host.arch",
    );
    expect(
      birthplaceDetector({ info, includeHostAttributes: true }).detect()
        .attributes,
    ).toMatchObject({
      "service.name": "payments",
      "birthplace.host.arch": "arm64",
      "birthplace.host.memory.total": 17_179_869_184,
    });
  });

  it("validates an already-loaded object during detect(), not at creation", () => {
    const detector = birthplaceDetector({
      info: { schemaVersion: 99 } as unknown as Birthplace,
    });
    expect(() => detector.detect()).toThrow(
      expect.objectContaining({
        name: "BirthplaceError",
        code: "BIRTHPLACE_VALIDATION_ERROR",
      }),
    );
  });

  it.each([
    ["a path", (file: string): string | URL => file],
    ["a file URL", (file: string): string | URL => pathToFileURL(file)],
  ])("rejects info combined with %s for file", (_name, toFile) => {
    const file = fixtureFile();
    writeFileSync(file, JSON.stringify(metadata));
    expect(() =>
      birthplaceDetector({ file: toFile(file), info: metadata }),
    ).toThrow(
      expect.objectContaining({
        name: "BirthplaceError",
        code: "BIRTHPLACE_VALIDATION_ERROR",
        message: "birthplaceDetector accepts either file or info, not both",
      }),
    );
  });

  it.each([
    ["missing file", undefined, "BIRTHPLACE_READ_ERROR"],
    ["malformed JSON", "{", "BIRTHPLACE_READ_ERROR"],
    [
      "unsupported schema",
      '{"schemaVersion":99}',
      "BIRTHPLACE_VALIDATION_ERROR",
    ],
  ])(
    "reports %s without falling back to runtime collection",
    (_name, contents, code) => {
      const file = fixtureFile();
      if (contents !== undefined) {
        writeFileSync(file, contents);
      }
      const detector = birthplaceDetector({ file });
      expect(() => detector.detect()).toThrow(BirthplaceError);
      try {
        detector.detect();
      } catch (error) {
        expect((error as BirthplaceError).code).toBe(code);
      }
    },
  );
});
