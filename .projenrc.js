import { javascript } from 'projen';
const project = new javascript.NodeProject({
  defaultReleaseBranch: "main",
  name: "cdk-local-diff",
  deps: [
    '@aws-cdk/cloudformation-diff',
    'json-diff',
    'commander',
    'chalk'
  ],                /* Runtime dependencies of this module. */
  description: 'Utility to compare two cdk.out folders',  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  packageName: 'cdk-local-diff',  /* The "name" in package.json. */
  bin: {
    'cld': './cld.js',
    'cdk-local-diff': './cld.js',
  },
  gitignore: [
    'test/cdk.*'
  ]
});
project.addFields({'type': 'module'});
project.synth();