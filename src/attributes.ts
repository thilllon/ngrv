/**
 * Mapping-only entry point. Its import graph contains no node:* module, so it also
 * works in bundles and runtimes without Node.js built-ins.
 */
export type { Birthplace, BuildTimestampSource } from "./birthplace";
export * from "./errors";
export * from "./otel-attributes";
