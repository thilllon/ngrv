import { BuildInfo, validateBuildInfo } from './build-info';

export type OtelAttributes = Record<string, string | boolean>;

export interface OtelAttributeOptions {
  /** Include custom dirty-state and build-time attributes. Defaults to false. */
  includeCustomAttributes?: boolean;
}

/** Maps metadata using OTel semantic conventions 1.44.0 (VCS/CI/CD are RC). */
export const toOtelAttributes = (
  value: BuildInfo,
  options: OtelAttributeOptions = {}
): OtelAttributes => {
  const info = validateBuildInfo(value);
  const attributes: OtelAttributes = {};

  if (info.service.name !== undefined) attributes['service.name'] = info.service.name;
  if (info.service.version !== undefined) attributes['service.version'] = info.service.version;
  if (info.source.revision !== undefined) {
    attributes['vcs.ref.head.revision'] = info.source.revision;
  }
  if (info.build.url !== undefined) attributes['cicd.pipeline.run.url.full'] = info.build.url;

  if (options.includeCustomAttributes) {
    if (info.source.dirty !== undefined) attributes['ngrv.source.dirty'] = info.source.dirty;
    if (info.build.timestamp !== undefined) {
      attributes['ngrv.build.timestamp'] = info.build.timestamp;
    }
    if (info.build.timestampSource !== undefined) {
      attributes['ngrv.build.timestamp_source'] = info.build.timestampSource;
    }
  }

  return attributes;
};
