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
  isArrowFunction,
  isExportDeclaration,
  isExportAssignment,
  NamedExports,
  ExportSpecifier,
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
  result.statements.forEach((s) => {
    getExportKeyword(s, exportKeywordList, result);
  });
  return exportKeywordList;
}

function getExportKeyword(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike
) {
  try {
    if (node.modifiers && node.modifiers[0].kind === SyntaxKind.ExportKeyword) {
      if (isVariableStatement(node)) {
        node.declarationList.declarations.forEach((declaration) => {
          const exportToken: IExportToken = {
            identifier: declaration.name.getText(),
            description: node.getText(),
            position: getLineAndCharacterOfPosition(source, declaration.pos),
            kind: 'variable',
          };
          // if (
          //   decleration.initializer &&
          //   needParams &&
          //   (isFunctionDeclaration(decleration.initializer) ||
          //     isArrowFunction(decleration.initializer))
          // ) {
          //   exportToken.params = getSignature(decleration.initializer);
          // }
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
          kind: 'function',
        };
        tokenList.push(exportToken);
      }
    } else if (isExportAssignment(node)) {
      const position = getLineAndCharacterOfPosition(
        source,
        node.expression!.getStart()
      );
      const exportToken: IExportToken = {
        identifier: 'default',
        position,
        description: node.getText(),
        kind: 'variable',
      };
      tokenList.push(exportToken);
    } else if (isExportDeclaration(node)) {
      (node.exportClause as NamedExports).elements.forEach((elm: ExportSpecifier) => {
        const position = getLineAndCharacterOfPosition(
          source,
          elm.name.getStart()
        );
        const exportToken: IExportToken = {
          identifier: elm.name.getText(),
          position,
          description: elm.getText(),
          kind: 'variable',
        };
        tokenList.push(exportToken);
      });
    }
  } catch (error) {}
}
