#!/usr/bin/env node

import { Command } from 'commander';
import { defaultOptions, engrave, readEngrave } from './ngrv';

const program = new Command();

program
  .command('create', { isDefault: true })
  .alias('c')
  .description('create ngrv files')
  .option('-d, --directory <dir>', 'directory where the ngrv files will be saved')
  .action(async (opts) => {
    const directory = opts.dir ?? defaultOptions.directory;
    engrave({ directory });
  });

program
  .command('read')
  .alias('r')
  .description('Read ngrv files')
  .option('-d, --directory <dir>', 'directory to read the ngrv files')
  .action(async (opts) => {
    const directory = opts.dir ?? defaultOptions.directory;
    readEngrave({ directory });
  });

program.parse(process.argv);

export const cli = program;
