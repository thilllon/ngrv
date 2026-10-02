import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

it.each([
  ["the generated birthplace file", [], "packaged JSON"],
  ["an imported birthplace object", ["--info"], "imported ESM"],
])(
  "carries %s into real NodeSDK exported spans after packaging",
  (_name, flags, source) => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        resolve("scripts/node-sdk-smoke.mts"),
        ...flags,
      ],
      {
        encoding: "utf8",
        timeout: 15000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`NodeSDK smoke passed: CLI -> ${source}`);
  },
);
