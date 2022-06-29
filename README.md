# cdk-local-diff
Compares two cdk.out folders and outputs the diff.

## Install
```bash
npm install cdk-local-diff
```

## Usage
```
Usage: cld [options] <folder1> <folder2>

Compares two cdk.out folders

Arguments:
  folder1              original cdk.out foler
  folder2              updated cdk.out foler

Options:
  -o|--outfile <file>  file to write to
  -h, --help           display help for command

Commands:
  help [command]       display help for command
```

## Automation
This has been created for use in GitHub Actions, to automatically compare cdk.out changes between branches. Example configuration will be added later.