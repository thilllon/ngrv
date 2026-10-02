#!/usr/bin/env node

import { Command, Option } from "commander";
import { collectBirthplace, CollectBirthplaceOptions } from "./collect";
import { BirthplaceError } from "./errors";
import { toOtelAttributes } from "./otel";
import { readBirthplace, writeBirthplace } from "./storage";

const program = new Command();

const reportError = (error: unknown): void => {
  if (error instanceof BirthplaceError) {
    console.error(`[${error.code}] ${error.message}`);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
};

program
  .command("generate", { isDefault: true })
  .description("generate a birthplace file with validated build metadata")
  .allowExcessArguments(false)
  .option(
    "--cwd <directory>",
    "project directory used for package and Git discovery",
  )
  .option("--output <file>", "birthplace file output path")
  .addOption(
    new Option("--format <format>", "birthplace file format")
      .choices(["json", "esm"])
      .default("json"),
  )
  .option("--service-name <name>", "service name")
  .option("--service-version <version>", "service version")
  .option("--revision <revision>", "full SHA-1 or SHA-256 source revision")
  .option("--build-url <url>", "HTTP(S) CI pipeline run URL")
  .option("--timestamp <timestamp>", "ISO build timestamp")
  .option("--no-timestamp", "omit the build timestamp")
  .option(
    "--strict",
    "require service name, service version, and source revision",
  )
  .option(
    "--host",
    "record the build machine: architecture, CPU, memory, and endianness",
  )
  .action((options) => {
    try {
      const collectOptions: CollectBirthplaceOptions = {
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        ...(options.serviceName === undefined
          ? {}
          : { name: options.serviceName }),
        ...(options.serviceVersion === undefined
          ? {}
          : { version: options.serviceVersion }),
        ...(options.revision === undefined
          ? {}
          : { revision: options.revision }),
        ...(options.buildUrl === undefined
          ? {}
          : { buildUrl: options.buildUrl }),
        ...(options.timestamp === undefined
          ? {}
          : { timestamp: options.timestamp }),
        ...(options.strict === undefined ? {} : { strict: options.strict }),
        ...(options.host === undefined ? {} : { host: options.host }),
      };
      const info = collectBirthplace(collectOptions);
      const file = writeBirthplace(info, {
        ...(options.output === undefined ? {} : { file: options.output }),
        format: options.format,
      });
      console.log(file);
    } catch (error) {
      reportError(error);
    }
  });

program
  .command("inspect [file]")
  .description("print the validated build metadata of a birthplace file")
  .option("--otel", "print OpenTelemetry resource attributes")
  .option(
    "--include-custom-attributes",
    "include custom build attributes with --otel",
  )
  .option(
    "--include-host-attributes",
    "include build machine attributes with --otel",
  )
  .action(
    (
      file: string | undefined,
      options: {
        otel?: boolean;
        includeCustomAttributes?: boolean;
        includeHostAttributes?: boolean;
      },
    ) => {
      try {
        const info = readBirthplace(file);
        const output = options.otel
          ? toOtelAttributes(info, {
              includeCustomAttributes: options.includeCustomAttributes,
              includeHostAttributes: options.includeHostAttributes,
            })
          : info;
        console.log(JSON.stringify(output, null, 2));
      } catch (error) {
        reportError(error);
      }
    },
  );

program.parse(process.argv);

export { program as default, program };
