import {
  Node,
  isFunctionDeclaration,
  isVariableStatement,
  createSourceFile,
  ScriptTarget,
  SyntaxKind,
  getLineAndCharacterOfPosition,
  LineAndCharacter,
  SourceFileLike,
  FunctionDeclaration,
  createMethodSignature,
  isJSDocParameterTag,
  JSDocTag,
  JSDocParameterTag,
  TypeChecker,
  createLanguageService
} from 'typescript';

interface IExportToken {
  identifier: string;
  description?: string;
  params?: string[];
  position: LineAndCharacter;
  kind: 'function' | 'variable';
}

export function traverse(filename: string, fileContent: string) {
  const exportKeywordList: IExportToken[] = [];
  const result = createSourceFile(
    filename,
    fileContent,
    ScriptTarget.ES2015,
    true
  );
  _traverse(result, exportKeywordList, result);
  return exportKeywordList;
}
function _traverse(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike,
  depth = 0
): void {
  getExportKeyword(node, tokenList, source);
  if (depth <= 1) {
    node.forEachChild((n: Node) => {
      _traverse(n, tokenList, source, depth + 1);
    });
  }
}

function getExportKeyword(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike,
  needParams: boolean = true
) {
  if (node.modifiers && node.modifiers[0].kind === SyntaxKind.ExportKeyword) {
    if (isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decleration => {
        tokenList.push({
          identifier: decleration.name.getText(),
          description: node.getText(),
          position: getLineAndCharacterOfPosition(source, decleration.pos),
          kind: 'variable'
        });
      });
    } else if (isFunctionDeclaration(node)) {
      const position = getLineAndCharacterOfPosition(
        source,
        node.name!.getStart()
      );
      const exportToken: IExportToken = {
        identifier: node.name!.getText(),
        position,
        description: node.getText(),
        kind: 'function'
      };
      if (needParams) {
        exportToken.params = getSignature(node);
      }
      tokenList.push(exportToken);

    }
  }
}

function getSignature(fc: FunctionDeclaration): string[] {
  // const checker: TypeChecker  = 
  // const service = createLanguageService();
  // const a = checker.getSignatureFromDeclaration(fc);
  // const paramsList: string[] = fc.parameters.map(item => item.name.getText());
  // const typeList: string[]  = Array.from({length: paramsList.length}).map(_ => 'any');
  // if ((<any>fc).jsDoc && (<any>fc).jsDoc.length) {
  //   const tagList: JSDocParameterTag[] = (<any>fc).jsDoc[0].tags.filter((tag: JSDocTag) => isJSDocParameterTag(tag));
  //   for (let i = 0; i < typeList.length; i++) {
  //     if (tagList[i]) {
  //       typeList[i] = tagList[i].typeExpression!.type.getText()
  //     }
  //   }
  // }
  // debugger;
  return [];
}
