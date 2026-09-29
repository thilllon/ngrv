import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/otel.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  platform: "node",
  target: "node22",
  fixedExtension: true,
  dts: true,
  sourcemap: true,
  clean: true,
  deps: { neverBundle: true },
  publint: { strict: true },
  attw: { level: "error" },
});
