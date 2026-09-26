#!/usr/bin/env node

import { Command, Option } from 'commander';
import { collectBuildInfo, CollectBuildInfoOptions } from './collect';
import { NgrvError } from './errors';
import { engrave, engraveDefaultOptions, readEngrave, readEngraveDefaultOptions } from './ngrv';
import { toOtelAttributes } from './otel';
import { readBuildInfo, writeBuildInfo } from './storage';

const program = new Command();

const reportError = (error: unknown): void => {
  if (error instanceof NgrvError) {
    console.error(`[${error.code}] ${error.message}`);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
};

program
  .command('generate', { isDefault: true })
  .description('generate a validated build metadata artifact')
  .option('--cwd <directory>', 'project directory used for package and Git discovery')
  .option('--output <file>', 'artifact output path')
  .addOption(
    new Option('--format <format>', 'artifact format').choices(['json', 'esm']).default('json')
  )
  .option('--name <name>', 'service name')
  .option('--service-version <version>', 'service version')
  .option('--revision <revision>', 'full SHA-1 or SHA-256 source revision')
  .option('--build-url <url>', 'HTTP(S) CI pipeline run URL')
  .option('--timestamp <timestamp>', 'ISO build timestamp')
  .option('--no-timestamp', 'omit the build timestamp')
  .option('--strict', 'require service name, service version, and source revision')
  .action((options) => {
    try {
      const collectOptions: CollectBuildInfoOptions = {
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.serviceVersion === undefined ? {} : { version: options.serviceVersion }),
        ...(options.revision === undefined ? {} : { revision: options.revision }),
        ...(options.buildUrl === undefined ? {} : { buildUrl: options.buildUrl }),
        ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
        ...(options.strict === undefined ? {} : { strict: options.strict }),
      };
      const info = collectBuildInfo(collectOptions);
      const file = writeBuildInfo(info, {
        ...(options.output === undefined ? {} : { file: options.output }),
        format: options.format,
      });
      console.log(file);
    } catch (error) {
      reportError(error);
    }
  });

program
  .command('inspect [file]')
  .description('print a validated build metadata artifact')
  .option('--otel', 'print OpenTelemetry resource attributes')
  .option('--include-custom', 'include custom build attributes with --otel')
  .action((file: string | undefined, options: { otel?: boolean; includeCustom?: boolean }) => {
    try {
      const info = readBuildInfo(file);
      const output = options.otel
        ? toOtelAttributes(info, { includeCustomAttributes: options.includeCustom })
        : info;
      console.log(JSON.stringify(output, null, 2));
    } catch (error) {
      reportError(error);
    }
  });

program
  .command('create')
  .alias('c')
  .description('create a legacy .ngrv file (deprecated; use generate)')
  .option(
    '-d, --directory <directory>',
    'directory where the ngrv files will be saved',
    engraveDefaultOptions.outputDirectory
  )
  .action(async ({ directory }) => {
    engrave({ outputDirectory: directory });
  });

program
  .command('read')
  .alias('r')
  .description('read a legacy .ngrv file (deprecated; use inspect)')
  .option(
    '-d, --directory <directory>',
    'directory to read the ngrv files',
    readEngraveDefaultOptions.directory
  )
  .action(async ({ directory }) => {
    readEngrave({ directory });
  });

program.parse(process.argv);

export { program as default, program };
