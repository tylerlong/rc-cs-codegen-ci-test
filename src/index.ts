#!/usr/bin/env node
import { prepareSpec } from 'ringcentral-open-api-parser';

import { generateDefinitions } from './definitions';
import { generatePaths } from './paths';
import { generateSamples } from './samples';

let index = process.argv.indexOf('-i');
let inputFile = '';
if (index !== -1) {
  inputFile = process.argv[index + 1];
} else {
  throw new Error('Please specify input file');
}
let outputDir = '';
index = process.argv.indexOf('-o');
if (index !== -1) {
  outputDir = process.argv[index + 1];
}

const parsed = prepareSpec(inputFile);
generateDefinitions(parsed, outputDir);
generatePaths(parsed, outputDir);
generateSamples(parsed, outputDir);
