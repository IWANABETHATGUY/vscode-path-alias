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
} from 'typescript';

interface IExportToken {
  identifier: string;
  description?: string;
  position: LineAndCharacter;
  kind: 'function' | 'variable'
}

export function traverse(filename: string, fileContent: string) {
  const exportKeywordList: IExportToken[] = [];
  const result = createSourceFile(
    filename,
    fileContent,
    ScriptTarget.ES2015,
    true,
  );
  _traverse(result, exportKeywordList, result);
  return exportKeywordList;
}
function _traverse(node: Node, tokenList: IExportToken[], source: SourceFileLike, depth = 0): void {
  getExportKeyword(node, tokenList, source);
  if (depth <= 1) {
    node.forEachChild((n: Node) => {
      _traverse(n, tokenList, source, depth + 1);
    });
  }
}

function getExportKeyword(node: Node, tokenList: IExportToken[], source: SourceFileLike) {
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
      const position = getLineAndCharacterOfPosition(source, node.name!.getStart());
      tokenList.push({
        identifier: node.name!.getText(),
        position,
        description: node.getText(),
        kind: 'function'
      });
    }
  }
}
