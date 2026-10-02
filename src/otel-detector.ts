import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Birthplace } from "./birthplace";
import { BirthplaceError } from "./errors";
import {
  OtelAttributeOptions,
  OtelAttributes,
  toOtelAttributes,
} from "./otel-attributes";
import { readBirthplace } from "./storage";

export interface BirthplaceDetectorOptions extends OtelAttributeOptions {
  /**
   * Birthplace file (JSON) path or file URL. Defaults to birthplace.json in the current
   * directory. Cannot be combined with `info`.
   */
  file?: string | URL;
  /**
   * Already-loaded build metadata, for example the default export of a generated ESM
   * birthplace file. The detector then performs no file access. Cannot be combined with
   * `file`.
   */
  info?: Birthplace;
}

/** Structurally compatible with OpenTelemetry 2.x ResourceDetector. */
export interface BirthplaceDetector {
  detect(): { attributes: OtelAttributes };
}

/**
 * Supplies packaged build metadata when the SDK detects resources; never probes Git.
 * It reads the birthplace file, or uses `info` as given without touching the filesystem.
 * Either source is validated during detect(), not when the detector is created.
 */
export const birthplaceDetector = (
  options: BirthplaceDetectorOptions = {},
): BirthplaceDetector => {
  const {
    info,
    includeCustomAttributes = false,
    includeHostAttributes = false,
  } = options;

  if (info !== undefined) {
    if (options.file !== undefined) {
      throw new BirthplaceError(
        "BIRTHPLACE_VALIDATION_ERROR",
        "birthplaceDetector accepts either file or info, not both",
      );
    }
    return {
      detect: () => ({
        attributes: toOtelAttributes(info, {
          includeCustomAttributes,
          includeHostAttributes,
        }),
      }),
    };
  }

  const file = resolve(
    options.file instanceof URL
      ? fileURLToPath(options.file)
      : (options.file ?? "birthplace.json"),
  );

  return {
    detect: () => ({
      attributes: toOtelAttributes(readBirthplace(file), {
        includeCustomAttributes,
        includeHostAttributes,
      }),
    }),
  };
};
