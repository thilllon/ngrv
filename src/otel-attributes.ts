import { Birthplace, validateBirthplace } from "./birthplace";

export type OtelAttributes = Record<string, string | number | boolean>;

export interface OtelAttributeOptions {
  /** Include custom dirty-state and build-time attributes. Defaults to false. */
  includeCustomAttributes?: boolean;
  /** Include the build machine as birthplace.host.* attributes. Defaults to false. */
  includeHostAttributes?: boolean;
}

/**
 * Maps build metadata to OTel semantic-convention attribute names, checked against
 * semantic conventions 1.43.0 (the @opentelemetry/semantic-conventions version in the
 * development tree). service.name and service.version are Stable. vcs.ref.head.revision
 * and cicd.pipeline.run.url.full are Release Candidate since 1.43.0, not Stable.
 *
 * birthplace.host.* attributes are custom, not semantic conventions: semconv host.*
 * describes the machine a process runs on, while these describe the machine that built
 * it. Each key is "birthplace." plus the JSON path. They mirror semconv naming where a
 * counterpart exists (host.arch and host.cpu.model.name, both Development in 1.43.0).
 */
export const toOtelAttributes = (
  value: Birthplace,
  options: OtelAttributeOptions = {},
): OtelAttributes => {
  const info = validateBirthplace(value);
  const attributes: OtelAttributes = {};

  if (info.service.name !== undefined) {
    attributes["service.name"] = info.service.name;
  }
  if (info.service.version !== undefined) {
    attributes["service.version"] = info.service.version;
  }
  if (info.source.revision !== undefined) {
    attributes["vcs.ref.head.revision"] = info.source.revision;
  }
  if (info.build.url !== undefined) {
    attributes["cicd.pipeline.run.url.full"] = info.build.url;
  }

  if (options.includeCustomAttributes) {
    if (info.source.dirty !== undefined) {
      attributes["birthplace.source.dirty"] = info.source.dirty;
    }
    if (info.build.timestamp !== undefined) {
      attributes["birthplace.build.timestamp"] = info.build.timestamp;
    }
    if (info.build.timestampSource !== undefined) {
      attributes["birthplace.build.timestamp_source"] =
        info.build.timestampSource;
    }
  }

  if (options.includeHostAttributes && info.host !== undefined) {
    const { host } = info;
    const hostAttributes: Record<string, string | number | undefined> = {
      "birthplace.host.arch": host.arch,
      "birthplace.host.cpu.model.name": host.cpu?.model?.name,
      "birthplace.host.cpu.logical.count": host.cpu?.logical?.count,
      "birthplace.host.memory.total": host.memory?.total,
      "birthplace.host.endianness": host.endianness,
    };
    for (const [key, attribute] of Object.entries(hostAttributes)) {
      if (attribute !== undefined) {
        attributes[key] = attribute;
      }
    }
  }

  return attributes;
};
