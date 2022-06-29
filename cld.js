#! /usr/bin/env node
import * as commander from 'commander';
import * as fs from 'fs';
import { stdout } from 'process';
import { compareProject } from './src/functions.js'

const cli = new commander.Command
cli.description("Compares two cdk.out folders");
cli.addHelpCommand(true);
cli.helpOption(true);
cli.argument('<folder1>', 'original cdk.out foler');
cli.argument('<folder2>', 'updated cdk.out foler');
cli.option('-o|--outfile <file>', 'file to write to');
cli.action((folder1, folder2, options) => {
  if (options.outfile) {
    var output = fs.createWriteStream(options.outfile);
  } else {
    var output = stdout
  };
  compareProject(folder1, folder2, output);
});
cli.parse(process.argv);
