import { BirthplaceError } from "./errors";

export type BuildTimestampSource = "clock" | "explicit" | "source-date-epoch";

export interface Birthplace {
  schemaVersion: 1;
  service: {
    name?: string;
    version?: string;
  };
  source: {
    revision?: string;
    dirty?: boolean;
  };
  build: {
    timestamp?: string;
    timestampSource?: BuildTimestampSource;
    url?: string;
  };
  /** The machine that ran the build. Present only when capture was requested. */
  host?: BirthplaceHost;
}

export type HostEndianness = "little" | "big";

/** Build-machine facts. Paths mirror OTel semantic-convention host.* naming. */
export interface BirthplaceHost {
  /** OTel semantic conventions host.arch value, such as amd64 or arm64. */
  arch?: string;
  cpu?: {
    model?: { name?: string };
    logical?: { count?: number };
  };
  memory?: {
    /** Total physical memory in bytes. */
    total?: number;
  };
  endianness?: HostEndianness;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validationError = (message: string): never => {
  throw new BirthplaceError("BIRTHPLACE_VALIDATION_ERROR", message);
};

function assertRecord(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    validationError(`${path} must be an object`);
  }
}

const optionalNonEmptyString = (
  object: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined => {
  const value = object[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    return validationError(`${path} must be a non-empty string when present`);
  }
  return value;
};

const optionalNonNegativeInteger = (
  object: Record<string, unknown>,
  key: string,
  path: string,
): number | undefined => {
  const value = object[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return validationError(
      `${path} must be a non-negative integer when present`,
    );
  }
  return value;
};

const optionalRecord = (
  object: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> => {
  const value = object[key];
  if (value === undefined) {
    return {};
  }
  assertRecord(value, path);
  return value;
};

const validateHost = (value: unknown): BirthplaceHost => {
  assertRecord(value, "host");
  const cpu = optionalRecord(value, "cpu", "host.cpu");
  const arch = optionalNonEmptyString(value, "arch", "host.arch");
  const modelName = optionalNonEmptyString(
    optionalRecord(cpu, "model", "host.cpu.model"),
    "name",
    "host.cpu.model.name",
  );
  const logicalCount = optionalNonNegativeInteger(
    optionalRecord(cpu, "logical", "host.cpu.logical"),
    "count",
    "host.cpu.logical.count",
  );
  const memoryTotal = optionalNonNegativeInteger(
    optionalRecord(value, "memory", "host.memory"),
    "total",
    "host.memory.total",
  );
  const endianness = value.endianness;
  if (
    endianness !== undefined &&
    endianness !== "little" &&
    endianness !== "big"
  ) {
    validationError('host.endianness must be "little" or "big" when present');
  }

  return {
    ...(arch === undefined ? {} : { arch }),
    ...(modelName === undefined && logicalCount === undefined
      ? {}
      : {
          cpu: {
            ...(modelName === undefined ? {} : { model: { name: modelName } }),
            ...(logicalCount === undefined
              ? {}
              : { logical: { count: logicalCount } }),
          },
        }),
    ...(memoryTotal === undefined ? {} : { memory: { total: memoryTotal } }),
    ...(endianness === undefined
      ? {}
      : { endianness: endianness as HostEndianness }),
  };
};

const normalizeIsoTimestamp = (value: string): string => {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) {
    return validationError("build.timestamp must be a valid ISO timestamp");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysPerMonth[month - 1]) {
    return validationError("build.timestamp must be a valid ISO timestamp");
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    return validationError("build.timestamp must be a valid ISO timestamp");
  }
  return new Date(milliseconds).toISOString();
};

const validateUrl = (value: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new BirthplaceError(
      "BIRTHPLACE_VALIDATION_ERROR",
      "build.url must be a valid URL",
      error,
    );
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password
  ) {
    validationError(
      "build.url must be an HTTP(S) URL without embedded credentials",
    );
  }
};

/**
 * Validates metadata and returns a fresh object containing only the documented fields.
 */
export const validateBirthplace = (value: unknown): Birthplace => {
  assertRecord(value, "Build metadata");
  if (value.schemaVersion !== 1) {
    validationError("schemaVersion must be 1");
  }
  assertRecord(value.service, "service");
  assertRecord(value.source, "source");
  assertRecord(value.build, "build");

  const name = optionalNonEmptyString(value.service, "name", "service.name");
  const version = optionalNonEmptyString(
    value.service,
    "version",
    "service.version",
  );
  const revision = optionalNonEmptyString(
    value.source,
    "revision",
    "source.revision",
  );
  const timestamp = optionalNonEmptyString(
    value.build,
    "timestamp",
    "build.timestamp",
  );
  const url = optionalNonEmptyString(value.build, "url", "build.url");
  const dirty = value.source.dirty;
  const timestampSource = value.build.timestampSource;

  if (
    revision !== undefined &&
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(revision)
  ) {
    validationError(
      "source.revision must be a full SHA-1 or SHA-256 commit ID",
    );
  }
  if (dirty !== undefined && typeof dirty !== "boolean") {
    validationError("source.dirty must be a boolean when present");
  }
  const validatedDirty = dirty as boolean | undefined;
  const normalizedTimestamp =
    timestamp === undefined ? undefined : normalizeIsoTimestamp(timestamp);
  if (
    timestampSource !== undefined &&
    timestampSource !== "clock" &&
    timestampSource !== "explicit" &&
    timestampSource !== "source-date-epoch"
  ) {
    validationError("build.timestampSource is invalid");
  }
  if ((timestamp === undefined) !== (timestampSource === undefined)) {
    validationError(
      "build.timestamp and build.timestampSource must be provided together",
    );
  }
  if (url !== undefined) {
    validateUrl(url);
  }
  const host = value.host === undefined ? undefined : validateHost(value.host);

  return {
    schemaVersion: 1,
    service: {
      ...(name === undefined ? {} : { name }),
      ...(version === undefined ? {} : { version }),
    },
    source: {
      ...(revision === undefined ? {} : { revision }),
      ...(validatedDirty === undefined ? {} : { dirty: validatedDirty }),
    },
    build: {
      ...(normalizedTimestamp === undefined
        ? {}
        : { timestamp: normalizedTimestamp }),
      ...(timestampSource === undefined
        ? {}
        : { timestampSource: timestampSource as BuildTimestampSource }),
      ...(url === undefined ? {} : { url }),
    },
    ...(host === undefined ? {} : { host }),
  };
};
