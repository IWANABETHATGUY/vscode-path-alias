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
  JSDocParameterTag,
  JSDocTag,
  isJSDocParameterTag,
  isArrowFunction,
  ArrowFunction
} from 'typescript';

export interface IExportToken {
  identifier: string;
  description?: string;
  params?: string[];
  position: LineAndCharacter;
  kind: 'function' | 'variable';
}

export function traverse(
  filename: string,
  fileContent: string,
  needParams: boolean = false
) {
  const exportKeywordList: IExportToken[] = [];
  const result = createSourceFile(
    filename,
    fileContent,
    ScriptTarget.ES2015,
    true
  );
  _traverse(result, exportKeywordList, result, needParams);
  return exportKeywordList;
}
function _traverse(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike,
  needParams: boolean,
  depth = 0
): void {
  getExportKeyword(node, tokenList, source, needParams);
  if (depth <= 1) {
    node.forEachChild((n: Node) => {
      _traverse(n, tokenList, source, needParams, depth + 1);
    });
  }
}

function getExportKeyword(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike,
  needParams: boolean = false
) {
  try {
    if (node.modifiers && node.modifiers[0].kind === SyntaxKind.ExportKeyword) {
      if (isVariableStatement(node)) {
        node.declarationList.declarations.forEach(decleration => {
          const exportToken: IExportToken = {
            identifier: decleration.name.getText(),
            description: node.getText(),
            position: getLineAndCharacterOfPosition(source, decleration.pos),
            kind: 'variable'
          };
          if (
            decleration.initializer &&
            needParams &&
            (isFunctionDeclaration(decleration.initializer) ||
              isArrowFunction(decleration.initializer))
          ) {
            exportToken.params = getSignature(decleration.initializer);
          }
          tokenList.push(exportToken);
        });
      } else if (isFunctionDeclaration(node) || isArrowFunction(node)) {
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
  } catch (error) {
    debugger;
  }
}

function getSignature(fc: FunctionDeclaration | ArrowFunction): string[] {
  const paramsList: string[] = fc.parameters.map(item => item.name.getText());
  const typeList: string[] = Array.from({ length: paramsList.length }).map(
    _ => 'any'
  );
  try {
    if ((<any>fc).jsDoc && (<any>fc).jsDoc.length) {
      const tagList: JSDocParameterTag[] = (<any>fc).jsDoc[0].tags.filter(
        (tag: JSDocTag) => isJSDocParameterTag(tag)
      );
      for (let i = 0; i < typeList.length; i++) {
        if (tagList[i]) {
          typeList[i] = tagList[i].typeExpression!.type.getText();
        }
      }
    }
    return paramsList.reduce(
      (pre, cur, index) => {
        pre.push(`${cur}: ${typeList[index]}`);
        return pre;
      },
      <string[]>[]
    );
  } catch (error) {
    return paramsList.reduce(
      (pre, cur, index) => {
        pre.push(`${cur}: ${typeList[index]}`);
        return pre;
      },
      <string[]>[]
    );
  }
}
