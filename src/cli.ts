#!/usr/bin/env node

import { Command } from 'commander';
import { defaultOptions, engrave, readEngrave } from './ngrv';

const program = new Command();

program
  .command('create', { isDefault: true })
  .alias('c')
  .description('create ngrv files')
  .option(
    '-d, --directory <directory>',
    'directory where the ngrv files will be saved',
    defaultOptions.directory
  )
  .action(async ({ directory }) => {
    engrave({ directory });
  });

program
  .command('read')
  .alias('r')
  .description('Read ngrv files')
  .option(
    '-d, --directory <directory>',
    'directory to read the ngrv files',
    defaultOptions.directory
  )
  .action(async ({ directory }) => {
    readEngrave({ directory });
  });

program.parse(process.argv);

export const cli = program;

export default program;
