import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/otel.ts', 'src/cli.ts'],
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: true,
  minify: true,
  shims: true,
  format: ['cjs', 'esm', 'iife'],
});
