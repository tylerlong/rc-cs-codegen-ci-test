import * as fs from "fs";
import * as path from "path";
import type { Field, ParseResult } from "ringcentral-open-api-parser/lib/types";

const normalizeField = (f: Field): Field => {
  if (
    [
      "event",
      "delegate",
      "ref",
      "default",
      "operator",
      "public",
      "params",
      "internal",
      "checked",
    ].includes(f.name)
  ) {
    f.name = `@${f.name}`;
  }
  if (f.$ref) {
    f.type = f.$ref;
  } else if (f.type === "number") {
    f.type = "decimal?";
  } else if (f.type === "integer") {
    f.type = "long?";
  } else if (f.type === "array") {
    f.type = `${normalizeField(f.items!).type}[]`;
  } else if (f.type === "dict") {
    f.type = `System.Collections.Generic.Dictionary<string, ${
      normalizeField(f.items!).type
    }>`;
  } else if (f.type === "boolean") {
    f.type = "bool?";
  }
  return f;
};

const generateField = (_f: Field) => {
  const f = normalizeField(_f);
  let p = "";
  if (f.name.startsWith("$")) {
    // $schema
    p += `[JsonProperty("${f.name}")]`;
    p += `\n        public ${f.type} ${f.name.substring(1)} { get; set; }`;
  } else if (f.name.includes("-")) {
    p += `[JsonProperty("${f.name}")]`;
    p += `\n        public ${f.type} ${
      f.name.replace(/-([a-z])/g, (match, p1: string) => p1.toUpperCase())
    };`;
  } else if (f.name.includes(":") || f.name.includes(".")) {
    p += `[JsonProperty("${f.name}")]`;
    p += `\n        public ${f.type} ${f.name.replace(/[:.](\w)/g, "_$1")};`;
  } else {
    p = `public ${f.type} ${f.name} { get; set; }`;
  }

  p = `/// </summary>\n        ${p}`;
  if (f.enum || f.items?.enum) {
    p = `///     Enum: ${(f.enum || f.items?.enum)!.join(", ")}\n        ${p}`;
  }
  if (f.default) {
    p = `///     Default: ${f.default}\n        ${p}`;
  }
  if (f.example) {
    p = `///     Example: ${f.example}\n        ${p}`;
  }
  if (f.format) {
    p = `///     Format: ${f.format}\n        ${p}`;
  }
  if (f.minimum) {
    p = `///     Minimum: ${f.minimum}\n        ${p}`;
  }
  if (f.maximum) {
    p = `///     Maximum: ${f.maximum}\n        ${p}`;
  }
  if (f.required) {
    p = `///     Required\n        ${p}`;
  }
  if (f.description) {
    p = `///     ${
      f.description.trim().split("\n").join("\n            ///     ")
    }\n        ${p}`;
  }
  p = `/// <summary>\n        ${p}`;
  return p;
};

export const generateDefinitions = (
  parsed: ParseResult,
  _outputDir: string,
) => {
  let outputDir = _outputDir;
  if (outputDir !== "") {
    outputDir = path.join(outputDir, "Definitions");
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);
  }
  parsed.models.forEach((model) => {
    let code = `namespace RingCentral
  {${
      model.description
        ? "\n    /// <summary>\n" +
          model.description
            .split("\n")
            .map((line) => "/// " + line)
            .join("\n") +
          "\n/// </summary>"
        : ""
    }
      public class ${model.name}
      {
          ${model.fields.map((f) => generateField(f)).join("\n\n        ")}
      }
  }`;
    if (code.includes("[JsonProperty(")) {
      code = "using Newtonsoft.Json;\n\n" + code;
    }
    if (outputDir !== "") {
      fs.writeFileSync(path.join(outputDir, `${model.name}.cs`), code);
    }
  });
};
