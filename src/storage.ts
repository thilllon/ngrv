import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { Birthplace, validateBirthplace } from "./birthplace";
import { BirthplaceError } from "./errors";

export interface WriteBirthplaceOptions {
  file?: string;
  format?: "json" | "esm";
}

const jsonSource = (info: Birthplace): string =>
  `${JSON.stringify(info, null, 2)}\n`;

export const writeBirthplace = (
  value: Birthplace,
  options: WriteBirthplaceOptions = {},
): string => {
  const info = validateBirthplace(value);
  const format = options.format ?? "json";
  const file = resolve(
    options.file ?? (format === "esm" ? "birthplace.mjs" : "birthplace.json"),
  );
  const directory = dirname(file);
  const temporaryFile = `${file}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  const source =
    format === "esm"
      ? `export default ${JSON.stringify(info, null, 2)};\n`
      : jsonSource(info);

  try {
    mkdirSync(directory, { recursive: true });
    writeFileSync(temporaryFile, source, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryFile, file);
    return file;
  } catch (error) {
    if (existsSync(temporaryFile)) {
      try {
        unlinkSync(temporaryFile);
      } catch {
        // Preserve the original write failure.
      }
    }
    throw new BirthplaceError(
      "BIRTHPLACE_WRITE_ERROR",
      `Unable to write build metadata to ${file}`,
      error,
    );
  }
};

export const readBirthplace = (file = "birthplace.json"): Birthplace => {
  const resolvedFile = resolve(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolvedFile, "utf8"));
  } catch (error) {
    throw new BirthplaceError(
      "BIRTHPLACE_READ_ERROR",
      `Unable to read build metadata from ${resolvedFile}`,
      error,
    );
  }
  return validateBirthplace(parsed);
};
