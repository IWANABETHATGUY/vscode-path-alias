import {
  Node,
  isFunctionDeclaration,
  isVariableStatement,
  createSourceFile,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';

// interface IExportToken {
//   identifier: string;
//   description: string;
// }
export function traverse(filename: string, fileContent: string) {
  const exportKeywordList: string[] = [];
  const result = createSourceFile(
    filename,
    fileContent,
    ScriptTarget.ES2015,
    true
  );
  _traverse(result, exportKeywordList);
  return exportKeywordList;
}
function _traverse(node: Node, tokenList: string[]): void {
  getExportKeyword(node, tokenList);
  node.forEachChild((n: Node) => {
    _traverse(n, tokenList);
  });
}

function getExportKeyword(node: Node, tokenList: string[]) {
  if (node.modifiers && node.modifiers[0].kind === SyntaxKind.ExportKeyword) {
    if (isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decleration => {
        tokenList.push(decleration.name.getText());
      });
    } else if (isFunctionDeclaration(node)) {
      tokenList.push(node.name!.getText());
    }
  }
}
