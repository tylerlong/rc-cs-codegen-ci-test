import * as fs from 'fs';
import * as path from 'path';
import { pascalCase, capitalCase } from 'change-case';
import * as R from 'ramda';
import { Operation, ParseResult } from 'ringcentral-open-api-parser/lib/types';

import { capitalizeFirstLetter } from './utils';

const generatePathMethod = (
  parameter: string | undefined,
  token: string,
  hasParent: boolean,
  noParentParameter: boolean,
  // eslint-disable-next-line max-params
): string => {
  if (parameter) {
    return `public string Path(bool withParameter = true)
        {
            if (withParameter && ${parameter} != null)
            {
                return $"${hasParent ? '{parent.Path()}' : ''}/${token}/{${parameter}}";
            }
            return $"${hasParent ? '{parent.Path()}' : ''}/${token}";
        }`;
  } else {
    let parentPath = '';
    if (hasParent) {
      if (noParentParameter) {
        parentPath = '{parent.Path(false)}';
      } else {
        parentPath = '{parent.Path()}';
      }
    }
    return `public string Path(bool withParameter = false)
        {
            return $"${parentPath}/${token.replace('dotSearch', '.search')}";
        }`;
  }
};

const generateBridgeMethod = (
  parameter: string | undefined,
  defaultValue: string | undefined,
  itemPaths: string[],
): string => {
  if (itemPaths.length > 1) {
    return `namespace RingCentral.Paths.${R.init(itemPaths).join('.')}
{
    public partial class Index
    {
        public ${itemPaths.join('.')}.Index ${R.last(itemPaths)}(${
      parameter ? `string ${parameter} = ${defaultValue ? `"${defaultValue}"` : null}` : ''
    })
        {
            return new ${itemPaths.join('.')}.Index(this${parameter ? `, ${parameter}` : ''});
        }
    }
}`;
  }
  return '';
};

const generateConstructor = (
  parameter: string | undefined,
  defaultValue: string | undefined,
  parentPaths: string[],
): string => {
  const result = ['public RestClient rc;'];
  if (parentPaths.length > 0) {
    result.push(`public ${parentPaths.join('.')}.Index parent;`);
  }
  if (parameter) {
    result.push(`public string ${parameter};`);
  }
  if (parentPaths.length > 0) {
    result.push(
      `public Index(${parentPaths.join('.')}.Index parent${
        parameter ? `, string ${parameter} = ${defaultValue ? `"${defaultValue}"` : null}` : ''
      })
      {`,
    );
    result.push('this.parent = parent;');
    result.push('this.rc = parent.rc;');
  } else {
    result.push(
      `public Index(RestClient rc${
        parameter ? `, string ${parameter} = ${defaultValue ? `"${defaultValue}"` : null}` : ''
      })
      {`,
    );
    result.push('this.rc = rc;');
  }
  if (parameter) {
    result.push(`this.${parameter} = ${parameter};`);
  }
  result.push('}');

  return result.join('\n');
};

// eslint-disable-next-line complexity
const generateOperationMethod = (operation: Operation, parameter: string | undefined): string => {
  // comments
  const comments = ['/// <summary>'];
  comments.push(
    `${(operation.description || operation.summary || capitalCase(operation.operationId))
      .split('\n')
      .map((l) => `/// ${l}`)
      .join('\n')}`,
  );
  comments.push(`/// HTTP Method: ${operation.method}`);
  comments.push(`/// Endpoint: ${operation.endpoint}`);
  if (operation.rateLimitGroup) {
    comments.push(`/// Rate Limit Group: ${operation.rateLimitGroup}`);
  }
  if (operation.appPermission) {
    comments.push(`/// App Permission: ${operation.appPermission}`);
  }
  if (operation.userPermission) {
    comments.push(`/// User Permission: ${operation.userPermission}`);
  }
  comments.push('/// </summary>');
  let result = comments.map((l) => `        ${l}`).join('\n');

  // responseType
  let responseType = 'string';
  if (operation.responseSchema) {
    if (operation.responseSchema.type === 'string' && operation.responseSchema.format === 'binary') {
      responseType = 'byte[]';
    } else if (operation.responseSchema.$ref) {
      responseType = `RingCentral.${operation.responseSchema.$ref}`;
    }
  }

  // methodParams
  const methodParams: string[] = [];
  if (operation.bodyParameters) {
    if (operation.bodyType) {
      methodParams.push(`${operation.bodyType} ${operation.bodyParameters}`);
    } else {
      methodParams.push(`RingCentral.${capitalizeFirstLetter(operation.bodyParameters)} ${operation.bodyParameters}`);
    }
  }
  if (operation.queryParameters) {
    methodParams.push(`RingCentral.${capitalizeFirstLetter(operation.queryParameters)} queryParams = null`);
  }
  methodParams.push('RestRequestConfig restRequestConfig = null');

  // requestParams
  const requestParams: string[] = [];
  requestParams.push(`this.Path(${!operation.withParameter && parameter ? 'false' : ''})`);
  if (operation.formUrlEncoded) {
    requestParams.push('new FormUrlEncodedContent(dict)');
  } else if (operation.multipart) {
    requestParams.push('multipartFormDataContent');
  } else if (operation.bodyParameters) {
    requestParams.push(operation.bodyParameters);
  }
  requestParams.push(operation.queryParameters ? 'queryParams' : 'null');
  requestParams.push('restRequestConfig');

  // result
  result += `
  public async Task<${responseType}> ${pascalCase(operation.method2)}(${methodParams.join(', ')})
  {\n`;
  if (operation.withParameter) {
    result += `if (${parameter} == null)
    {
        throw new System.ArgumentException("Parameter cannot be null", nameof(${parameter}));
    }`;
  }
  if (operation.formUrlEncoded) {
    result += `var dict = new System.Collections.Generic.Dictionary<string, string>();
    Utils.GetPairs(${operation.bodyParameters}).ToList().ForEach(t => dict.Add(t.name, t.value.ToString()));\n`;
  } else if (operation.multipart) {
    result += `var multipartFormDataContent = Utils.GetMultipartFormDataContent(${operation.bodyParameters});\n`;
  }
  result += `return await rc.${capitalizeFirstLetter(operation.method)}<${responseType}>(${requestParams.join(', ')});
  }`;
  return result;
};

export const generatePaths = (parsed: ParseResult, _outputDir: string) => {
  let outputDir = _outputDir;
  if (outputDir !== '') {
    outputDir = path.join(outputDir, 'Paths');
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);
  }

  for (const item of parsed.paths) {
    const itemPaths = item.paths.map((p) => pascalCase(p));
    const code = `
using System.Threading.Tasks;
using System.Linq;
using System.Net.Http;

namespace RingCentral.Paths.${itemPaths.join('.')}
{
    public partial class Index
    {
        ${generateConstructor(item.parameter, item.defaultParameter, R.init(itemPaths))}
        ${generatePathMethod(
          item.parameter,
          R.last(item.paths)!,
          itemPaths.length > 1,
          item.noParentParameter === true,
        )}
${item.operations.map((operation) => generateOperationMethod(operation, item.parameter)).join('\n\n')}
    }
}

${generateBridgeMethod(item.parameter, item.defaultParameter, itemPaths)}
`;
    if (outputDir !== '') {
      const folder = path.join(outputDir, ...itemPaths);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'Index.cs'), code.trim());
    }
  }
};
