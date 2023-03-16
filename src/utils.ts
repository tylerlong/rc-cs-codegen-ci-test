import { parse } from 'ringcentral-open-api-parser';
import yaml from 'js-yaml';
import fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';

export const capitalizeFirstLetter = (s: string): string => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const parseSpec = (inputFile: string) => {
  const doc = yaml.load(fs.readFileSync(inputFile, 'utf8')) as OpenAPIV3.Document;
  return parse(doc);
};
