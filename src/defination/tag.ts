import {
  DefinitionProvider,
  TextDocument,
  Position,
  CancellationToken,
  ProviderResult,
  Location,
  LocationLink,
  Disposable,
  Uri
} from 'vscode';
import { AliasStatTree, StatInfo } from '../completion/type';
import {
  mostLikeAlias,
  transformHyphenToPascal,
  transformCamelToPascal,
  getIndexOfWorkspaceFolder
} from '../util/common';
import { Nullable } from '../util/types';

export class PathAliasTagDefinition implements DefinitionProvider {
  private _statMap!: AliasStatTree[];
  private _disposable: Disposable;
  private _aliasList: string[][] = [];
  constructor(statMap: AliasStatTree[], aliasList: string[][]) {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
    this.setStatMapAndAliasList(statMap, aliasList);
  }
  dispose() {
    this._disposable.dispose();
  }
  setStatMapAndAliasList(statMap: AliasStatTree[], aliasList: string[][]) {
    this._statMap = statMap;
    this._aliasList = aliasList;
  }
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Location | Location[] | LocationLink[]> {
    console.time('tag-defination');
    const reg = /\<([\w-]+).*?/;
    const range = document.getWordRangeAtPosition(position, reg);
    const sourceCode = document.getText();
    const index = getIndexOfWorkspaceFolder(document.uri);
    if (index === undefined) return null;
    if (range) {
      const importDefaultDeclarationReg = /import\s+(\w+)\s+from\s(\'(?:.*?)\'|\"(?:.*?)\")/g;
      const tag = document
        .getText(range)
        .replace('<', '')
        .trim();
      const normalizedTag = transformHyphenToPascal(
        transformCamelToPascal(tag)
      );
      let regMatch: Nullable<RegExpExecArray> = null;
      let aliasPath: string = '';
      while ((regMatch = importDefaultDeclarationReg.exec(sourceCode))) {
        const [, localIdentifier, path] = regMatch;
        if (transformCamelToPascal(localIdentifier) === normalizedTag) {
          aliasPath = path.slice(1, -1);
          break;
        }
      }
      if (aliasPath) {
        const mostLike = mostLikeAlias(
          this._aliasList[index],
          aliasPath.split('/')[0]
        );
        let statInfo: StatInfo = this._statMap[index][mostLike];
        const absolutePath = aliasPath.replace(mostLike, statInfo.absolutePath);
        console.timeEnd('tag-defination');
        const normalizedAbsolutePath =
          absolutePath + (absolutePath.endsWith('vue') ? '' : '.vue');
        return new Location(
          Uri.file(normalizedAbsolutePath),
          new Position(0, 0)
        );
      }
    }
    return null;
  }
}
