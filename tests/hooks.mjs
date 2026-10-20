import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const srcRoot = resolvePath(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src"
);

const SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const isFile = (path) => existsSync(path) && statSync(path).isFile();

const findFile = (base) => {
  for (const suffix of SUFFIXES) {
    if (isFile(base + suffix)) return base + suffix;
  }
  return undefined;
};

export async function resolve(specifier, context, nextResolve) {
  let base;

  if (specifier.startsWith("@/")) {
    base = resolvePath(srcRoot, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }

  const file = base && findFile(base);
  if (file) {
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !/\.tsx?$/.test(url)) {
    return nextLoad(url, context);
  }

  const source = readFileSync(fileURLToPath(url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  });

  return { format: "module", source: outputText, shortCircuit: true };
}
