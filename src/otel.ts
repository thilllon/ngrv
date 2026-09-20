import { BuildInfo, validateBuildInfo } from './build-info';

export type OtelAttributes = Record<string, string | boolean>;

export const toOtelAttributes = (value: BuildInfo): OtelAttributes => {
  const info = validateBuildInfo(value);
  const attributes: OtelAttributes = {};

  if (info.service.name !== undefined) attributes['service.name'] = info.service.name;
  if (info.service.version !== undefined) attributes['service.version'] = info.service.version;
  if (info.source.revision !== undefined) {
    attributes['ngrv.source.revision'] = info.source.revision;
  }
  if (info.source.dirty !== undefined) attributes['ngrv.source.dirty'] = info.source.dirty;
  if (info.build.timestamp !== undefined) {
    attributes['ngrv.build.timestamp'] = info.build.timestamp;
  }
  if (info.build.timestampSource !== undefined) {
    attributes['ngrv.build.timestamp_source'] = info.build.timestampSource;
  }
  if (info.build.url !== undefined) attributes['ngrv.build.url'] = info.build.url;

  return attributes;
};
