import * as ts from 'typescript';
// import * as fs from 'fs';
// import * as path from 'path';
export interface IFunctionSignature {
  name?: string;
  fileName?: string;
  documentation?: string;
  type?: string;
  parameters?: IFunctionSignature[];
  returnType?: string;
  optional?: boolean;
}

export function getFuncitonSignatureFromFiles(
  files: { fileName: string; content: string }[]
) {
  // Build a program using the set of root file names in fileNames
  console.time('typechecker');
  console.time('createProgram');
  debugger;
  const program = createProgram(files);
  console.timeEnd('createProgram');

  const doc = generateDocumentation(program);
  console.timeEnd('typechecker');
  return doc;
}

/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(program: ts.Program): IFunctionSignature[] {
  // Get the checker, we will use it to find more about classes
  let checker = program.getTypeChecker();
  let output: IFunctionSignature[] = [];
  let sourceFiles = program.getSourceFiles();
  // Visit every sourceFile in the program
  for (const sourceFile of sourceFiles) {
    if (!sourceFile.isDeclarationFile) {
      debugger;
      // Walk the tree to search for classes
      ts.forEachChild(sourceFile, visit);
    }
  }
  return output;

  /** visit nodes finding exported classes */
  function visit(node: ts.Node) {
    // Only consider exported nodes
    if (!isNodeExported(node)) {
      return;
    }
    if (
      (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) &&
      node.name
    ) {
      // This is a top level class, get its symbol
      let symbol = checker.getSymbolAtLocation(node.name);
      if (symbol) {
        output.push(serializeFunction(symbol));
      }
      // No need to walk any further, class expressions/inner declarations cannot be exported
    }
  }

  /** Serialize a symbol into a json object */
  function serializeSymbol(symbol: ts.Symbol): IFunctionSignature {
    if (symbol.getName() === 'bodyFixed') {
      debugger;
    }
    // const text = symbol.valueDeclaration.getText();
    const docEntry: IFunctionSignature = {
      name: symbol.getName(),
      documentation: ts.displayPartsToString(
        symbol.getDocumentationComment(checker)
      ),
      type: checker.typeToString(
        checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)
      )
    };
    const declaration = symbol.valueDeclaration;
    if (ts.isParameter(declaration) && declaration.initializer) {
      docEntry.optional = true;
    }
    return docEntry;
  }

  /** Serialize a class symbol information */
  function serializeFunction(symbol: ts.Symbol) {
    let details = serializeSymbol(symbol);
    // Get the construct signatures
    let constructorType = checker.getTypeOfSymbolAtLocation(
      symbol,
      symbol.valueDeclaration!
    );
    if (symbol.name === 'bodyFixed') {
      debugger;
      let type = checker.typeToString(constructorType);
      console.log(type)
    }
    details = {
      ...constructorType.getCallSignatures().map(serializeSignature)[0],
      ...details
    };
    return details;
  }

  /** Serialize a signature (call or construct) */
  function serializeSignature(signature: ts.Signature) {
    return {
      parameters: signature.parameters.map(serializeSymbol),
      returnType: checker.typeToString(signature.getReturnType()),
      documentation: ts.displayPartsToString(
        signature.getDocumentationComment(checker)
      )
    };
  }

  /** True if this is visible outside this file, false otherwise */
  function isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as any) & ts.ModifierFlags.Export) !==
        0 ||
      (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }
}

/** creates a dummy ts.Program in memory with given source files inside */
export function createProgram(
  files: {
    fileName: string;
    content: string;
    sourceFile?: ts.SourceFile;
  }[],
  compilerOptions?: ts.CompilerOptions
): ts.Program {
  const tsConfigJson = ts.parseConfigFileTextToJson(
    'tsconfig.json',
    compilerOptions
      ? JSON.stringify(compilerOptions)
      : `{
        "compilerOptions": {
          "target": "es2018",   
          "module": "commonjs", 
          "lib": ["es2018"],
          "rootDir": ".",
          "strict": false,   
          "esModuleInterop": true,
          "moduleResolution": "node",
        }
  `
  );
  let { options, errors } = ts.convertCompilerOptionsFromJson(
    tsConfigJson.config.compilerOptions,
    '.'
  );
  if (errors.length) {
    throw errors;
  }
  const compilerHost = ts.createCompilerHost(options);
  compilerHost.getSourceFile = function(
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ): ts.SourceFile | undefined {
    const file = files.find(f => f.fileName === fileName);
    if (!file) return undefined;
    file.sourceFile =
      file.sourceFile ||
      ts.createSourceFile(fileName, file.content, ts.ScriptTarget.ES2015, true);
    return file.sourceFile;
  };
  // in order to typechecker to work we need to implement the following method, the following implementation is enough:
  // compilerHost.resolveTypeReferenceDirectives = function(
  //   typeReferenceDirectiveNames: string[],
  //   containingFile: string
  // ): (ts.ResolvedTypeReferenceDirective | undefined)[] {
  //   return [];
  // };
  return ts.createProgram(files.map(f => f.fileName), options, compilerHost);
}
// const fileList = [
//   {
//     fileName: 'testtest1.ts',
//     content: fs.readFileSync(path.resolve(__dirname, 'test.js')).toString()
//   }
// ];

// const result = getFuncitonSignatureFromFiles(fileList);
// console.log(result);
