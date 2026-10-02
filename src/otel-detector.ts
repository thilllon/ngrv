import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OtelAttributeOptions,
  OtelAttributes,
  toOtelAttributes,
} from "./otel-attributes";
import { readBirthplace } from "./storage";

export interface BirthplaceDetectorOptions extends OtelAttributeOptions {
  /** Birthplace file (JSON) path or file URL. Defaults to birthplace.json in the current directory. */
  file?: string | URL;
}

/** Structurally compatible with OpenTelemetry 2.x ResourceDetector. */
export interface BirthplaceDetector {
  detect(): { attributes: OtelAttributes };
}

/** Reads the packaged birthplace file when the SDK detects resources; never probes Git. */
export const birthplaceDetector = (
  options: BirthplaceDetectorOptions = {},
): BirthplaceDetector => {
  const file = resolve(
    options.file instanceof URL
      ? fileURLToPath(options.file)
      : (options.file ?? "birthplace.json"),
  );
  const { includeCustomAttributes = false, includeHostAttributes = false } =
    options;

  return {
    detect: () => ({
      attributes: toOtelAttributes(readBirthplace(file), {
        includeCustomAttributes,
        includeHostAttributes,
      }),
    }),
  };
};
