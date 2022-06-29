#! /usr/bin/env node
import * as commander from 'commander';
import * as cfdiff from '@aws-cdk/cloudformation-diff';
import * as jsonDiff from 'json-diff'
import * as fs from 'fs';
import { stdout } from 'process';
import chalk from 'chalk';

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
  compare(folder1, folder2, output);
});
cli.parse(process.argv);

function loadFile(fileName) {
  try {
    var file = fs.readFileSync(fileName);
  } catch {
    console.log(chalk.yellow(`Template ${fileName} not found, returning empty object.`));
    return {};
  };
  return JSON.parse(file);  
};

function getStacksFromManifest(manifest) {
  let stacks = {};
  for (const [key, value] of Object.entries(manifest.artifacts)) {
    if (value.type === 'aws:cloudformation:stack') {
      let stackPath = value.properties.templateFile;
      let nestedStacks = getNestedStacks(stackPath, key);
      stacks[key] = {};
      stacks[key].path = stackPath;
      if (nestedStacks) {
        stacks[key].nestedStacks = nestedStacks;
      };
    };
  };
  return stacks;
};

function getNestedStacks(nestedStackPath, parentStack) {
  let nested = {};
  let resources = loadResources(nestedStackPath);
  for (const [key, value] of Object.entries(resources)) {
    if (value.Type === 'AWS::CloudFormation::Stack') {
      let nestedStackPath = getNestedStackPath(value, parentStack);
      let nestedStacks = getNestedStacks(nestedStackPath, parentStack);
      nested[key] = {};
      nested[key].path = nestedStackPath;
      if (nestedStacks) {
        nested[key].nestedStacks = nestedStacks;
      };
    };
  };
  if (Object.keys(nested).length > 0) {
    return nested;
  };
};

function buildTree(folder) {
  let wd = process.cwd();
  process.chdir(folder);
  let manifest = loadFile('manifest.json');
  let tree = getStacksFromManifest(manifest);
  process.chdir(wd);
  return tree;
};

function getNestedStackPath(resource, stackName) {
  let assetId = getAssetId(resource);
  return loadAsset(assetId, stackName);
};

function getAssetId(resource) {
  let filePath = resource.Properties.TemplateURL['Fn::Join'][1][2];
  let fullFileName = filePath.split('/')[2];
  return fullFileName.split('.')[0];
};

function loadAsset(assetId, stackName) {
  let assets = loadFile(`${stackName}.assets.json`);
  return assets.files[assetId].source.path;
};

function loadResources(fileName) {
  let file = loadFile(fileName);
  return file.Resources;
};

function comp(a, b, output) {
  let oldFile = loadFile(a);
  let newFile = loadFile(b);
  let difference = cfdiff.diffTemplate(oldFile,newFile);
  cfdiff.formatDifferences(
    output,
    difference
  );
};

function compare(current, updated, output) {
  let curState = buildTree(current);
  let updatedState = buildTree(updated);
  let treeDifference = jsonDiff.diffString(curState, updatedState);
  title('Cdk.out structure changes', output)
  if (Object.keys(treeDifference).length > 0 ) {
    console.log(treeDifference);
  } else {
    write('No difference in structure\n', output, 'green');
  };
  let templates = parseChildren(updatedState);
  templates.forEach(template => {
    comp(`${current}/${template}`, `${updated}/${template}`, output);
  });
};

function parseChildren(tree) {
  let templates = [];
  for (const [key, value] of Object.entries(tree)) {
    if (value.nestedStacks) {
      templates.push(...parseChildren(value.nestedStacks));
    };
    templates.push(value.path);
  };
  return templates;
};

function write(string, output, color) {
  let nl = '\n';
  try {
    chalk[color]();
  } catch {
    color = 'white';
  };
  output.write(chalk[color](string+nl))
}

function title(string, output, color) {
  write(chalk.underline.bold(string), output, color)
}