#! /usr/bin/env node
import * as cfdiff from '@aws-cdk/cloudformation-diff';
import * as jsonDiff from 'json-diff'
import * as fs from 'fs';
import chalk from 'chalk';

/**
 * loads json file from disk
 * @param  {String} fileName  The path of the file to read
 * @return {Object}           Contents of the file in Object format
 */
function loadFile(fileName) {
  try {
    var file = fs.readFileSync(fileName);
  } catch {
    console.log(chalk.yellow(`Template ${fileName} not found, returning empty object.`));
    return {};
  };
  return JSON.parse(file);  
};

/**
 * Takes manifest and gets all resources of type AWS::CloudFormation::Stack, including the path to the template.
 * @param  {Object} manifest  Object containing information from the manifest.json file
 * @return {Object}           Object with key value pairs containing stack names, paths and nested stacks.
 */
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

/**
 * Gets nested stacks for a specific stack
 * @param  {String} nestedStackPath Path to the Nested Stack template
 * @param  {String} parentStack     Name of the stack that has this stack Nested
 * @return {Object}                 Object with key value pairs containing stack names, paths and nested stacks.
 */
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

/**
 * Iterates over the cdk.out folder
 * @param  {String} folder Path to the cdk.out folder
 * @return {Object}        Object with key value pairs containing stack names, paths and nested stacks.
 */
function buildTree(folder) {
  let wd = process.cwd();
  process.chdir(folder);
  let manifest = loadFile('manifest.json');
  let tree = getStacksFromManifest(manifest);
  process.chdir(wd);
  return tree;
};

/**
 * Gets path to the nested stack template file
 * @param  {Object} resource  Object of type AWS::CloudFormation::Stack
 * @param  {String} stackName Name of the stack to fetch
 * @return {String}           Path to the nested stack template file
 */
function getNestedStackPath(resource, stackName) {
  let assetId = getAssetId(resource);
  return loadAsset(assetId, stackName);
};

/**
 * Parses AWS::CloudFormation::Stack Object to get the id of the Nested Stack template ID
 * @param  {Object} resource  Object of type AWS::CloudFormation::Stack
 * @return {String}           Asset ID of the Stack Template
 */
function getAssetId(resource) {
  let filePath = resource.Properties.TemplateURL['Fn::Join'][1][2];
  let fullFileName = filePath.split('/')[2];
  return fullFileName.split('.')[0];
};

/**
 * Gets template file path based on the Asset ID
 * @param  {String} assetId   ID of the asset to find
 * @param  {String} stackName Name of the stack to fetch
 * @return {String}           Path to the template
 */
function loadAsset(assetId, stackName) {
  let assets = loadFile(`${stackName}.assets.json`);
  return assets.files[assetId].source.path;
};

/**
 * Returns the Resources value from a json file
 * @param  {String} fileName  Path to the file to read
 * @return {Object}           Object containing the templates resources
 */
function loadResources(fileName) {
  let file = loadFile(fileName);
  return file.Resources;
};

/**
 * Does the diff between two templates and outputs the result to a stream
 * @param  {String} currentFile Path to template containing the old state
 * @param  {String} updatedFile Path to template containing the updated state
 * @param  {Stream} output      Stream to output to
 */
function compareTemplate(currentFile, updatedFile, output) {
  let oldFile = loadFile(currentFile);
  let newFile = loadFile(updatedFile);
  let difference = cfdiff.diffTemplate(oldFile,newFile);
  cfdiff.formatDifferences(
    output,
    difference
  );
};

/**
 * Main function that contains logic
 * @param  {String} current Path to the cdk.out folder containing the previous state
 * @param  {String} updated Path to the cdk.out folder containing the new state
 * @param  {Stream} output  Destination stream to write the results to
 */
export function compareProject(current, updated, output) {
  let curState = buildTree(current);
  let updatedState = buildTree(updated);
  treeDiff(curState, updatedState, output);
  let templates = parseChildren(updatedState);
  templates.forEach(template => {
    compareTemplate(`${current}/${template}`, `${updated}/${template}`, output);
  });
};

/**
 * Compares two Objects and shows the differences between them
 * @param  {Object} curState Object containing a tree of the current state of the cdk.out folder
 * @param  {Object} updatedState Object containing a tree of the updated state of the cdk.out folder
 * @param  {Stream} output  Destination stream to write the results to
 */
function treeDiff(curState, updatedState, output) {
  let treeDifference = jsonDiff.diffString(curState, updatedState, output);
  title('Cdk.out structure changes', output)
  if (Object.keys(treeDifference).length > 0 ) {
    console.log(treeDifference);
  } else {
    write('No difference in structure\n', output, 'green');
  };
};

/**
 * Creates a list of template files to iterate over
 * @param  {Object} tree  The project tree to digest
 * @return {List}         List containing all project templates present in the updated state
 */
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

/**
 * Writes to output stream using color coding
 * @param  {String} string String to write
 * @param  {Stream} output Stream to write to
 * @param  {String} color  The color that the string should be, defaults to white
 */
function write(string, output, color) {
  let nl = '\n';
  try {
    chalk[color]();
  } catch {
    color = 'white';
  };
  output.write(chalk[color](string+nl))
}

/**
 * Writes to output stream using color coding, but in bold and underlined
 * @param  {String} string String to write
 * @param  {Stream} output Stream to write to
 * @param  {String} color  The color that the string should be
 */
function title(string, output, color) {
  write(chalk.underline.bold(string), output, color)
}