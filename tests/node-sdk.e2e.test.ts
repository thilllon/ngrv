import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

it("carries the generated birthplace file into real NodeSDK exported spans after packaging", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      resolve("scripts/node-sdk-smoke.mts"),
    ],
    {
      encoding: "utf8",
      timeout: 15000,
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("NodeSDK smoke passed");
});
