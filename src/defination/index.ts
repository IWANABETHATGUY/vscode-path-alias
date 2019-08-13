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
import { isObject } from '../util/common';
export class PathAliasDefinition implements DefinitionProvider {
  private _statMap: AliasStatTree;
  private _disposable: Disposable;
  private _aliasList: string[] = [];
  constructor(statMap: AliasStatTree) {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
    this._statMap = statMap;
    this._aliasList = Object.keys(this._statMap).sort();
  }
  dispose() {
    this._disposable.dispose();
  }
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Location | Location[] | LocationLink[]> {
    const reg = /\"(.*)\"|\'(.*)\'/;
    const range = document.getWordRangeAtPosition(position, reg);
    if (range) {
      const inputPath = document.getText(range);
      const resPath = inputPath.slice(1, -1);
      const mostLike = mostLikeAlias(this._aliasList, resPath);
      if (mostLike) {
        let statInfo: StatInfo = this._statMap[mostLike];
        let splitPath = resPath
          .split('/')
          .slice(1)
          .filter(Boolean);
        const lastPath = splitPath.reduce((pre: StatInfo | null, cur) => {
          if (isObject(pre)) {
            pre = pre.children[cur];
            return pre;
          }
          return null;
        }, statInfo);
        if (lastPath && lastPath.type === 'file') {
          return new Location(Uri.file(lastPath.absolutePath), new Position(0, 0));
        }
      }
    }
    return null;
  }
}


function mostLikeAlias(aliasList: string[], path: string) : string{
  let index = -1;
  aliasList.forEach((curAlias, i) => {
    if (path.startsWith(curAlias)) {
      index = i;
    }
  })
  return index !== -1 ? aliasList[index] : '';
}