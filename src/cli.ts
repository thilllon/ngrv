#!/usr/bin/env node

import { Command } from 'commander';
import { engrave, engraveDefaultOptions, readEngrave, readEngraveDefaultOptions } from './ngrv';

const program = new Command();

program
  .command('create', { isDefault: true })
  .alias('c')
  .description('create ngrv files')
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
  .description('Read ngrv files')
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
