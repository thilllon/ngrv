import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { OtelAttributeOptions, OtelAttributes, toOtelAttributes } from './otel-attributes';
import { readBuildInfo } from './storage';

export interface NgrvDetectorOptions extends OtelAttributeOptions {
  /** JSON artifact path or file URL. Defaults to build-info.json in the current directory. */
  file?: string | URL;
}

/** Structurally compatible with OpenTelemetry 2.x ResourceDetector. */
export interface NgrvResourceDetector {
  detect(): { attributes: OtelAttributes };
}

/** Reads the packaged build artifact when the SDK detects resources; never probes Git. */
export const ngrvDetector = (options: NgrvDetectorOptions = {}): NgrvResourceDetector => {
  const file = resolve(
    options.file instanceof URL ? fileURLToPath(options.file) : options.file ?? 'build-info.json'
  );
  const { includeCustomAttributes = false } = options;

  return {
    detect: () => ({
      attributes: toOtelAttributes(readBuildInfo(file), { includeCustomAttributes }),
    }),
  };
};
