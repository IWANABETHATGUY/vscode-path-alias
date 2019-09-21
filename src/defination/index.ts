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
import { isObject, mostLikeAlias } from '../util/common';
import { resolve, extname } from 'path';
import { existsSync } from 'fs';
import { Nullable } from '../util/types';
export class PathAliasDefinition implements DefinitionProvider {
  private _statMap!: AliasStatTree;
  private _disposable: Disposable;
  private _aliasList: string[] = [];
  constructor(statMap: AliasStatTree) {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
    this.setStatMap(statMap);
  }
  dispose() {
    this._disposable.dispose();
  }
  setStatMap(statMap: AliasStatTree) {
    this._statMap = statMap;
    this._aliasList = Object.keys(this._statMap).sort();
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
      const mostLike = mostLikeAlias(this._aliasList, resPath.split('/')[0]);

      if (mostLike) {
        let statInfo: StatInfo = this._statMap[mostLike];
        let splitPath = resPath
          .split('/')
          .slice(1)
          .filter(Boolean);
        const lastStatInfo = splitPath
          .slice(0, -1)
          .reduce((pre: Nullable<StatInfo>, cur) => {
            if (isObject(pre)) {
              pre = pre.children[cur];
              return pre;
            }
            return null;
          }, statInfo);
        const currentDocumentExt = extname(document.uri.path);

        if (lastStatInfo) {
          let lastPath = lastStatInfo.children[splitPath[splitPath.length - 1]];
          if (lastPath) {
            if (lastPath.type === 'file') {
              return new Location(
                Uri.file(lastPath.absolutePath),
                new Position(0, 0)
              );
            } else {
              const currentFileIndexPath = resolve(
                lastPath.absolutePath,
                `index.${currentDocumentExt}`
              );
              const currentFileIndexJsPath = resolve(
                lastPath.absolutePath,
                `index.js`
              );
              if (existsSync(currentFileIndexPath)) {
                return new Location(
                  Uri.file(currentFileIndexPath),
                  new Position(0, 0)
                );
              } else if (existsSync(currentFileIndexJsPath)) {
                return new Location(
                  Uri.file(currentFileIndexJsPath),
                  new Position(0, 0)
                );
              }
            }
          } else {
            const lastPathDir = lastStatInfo.absolutePath;
            const lastPathString = splitPath[splitPath.length - 1];
            const lastPathPrefix =resolve(lastPathDir, lastPathString) ;
            const currentDocumentTypePath =
               lastPathPrefix+ currentDocumentExt;
            const JsTypePath = lastPathPrefix + '.js';
            if (existsSync(currentDocumentTypePath)) {
              return new Location(
                Uri.file(currentDocumentTypePath),
                new Position(0, 0)
              );
            } else if (existsSync(JsTypePath)) {
              return new Location(Uri.file(JsTypePath), new Position(0, 0));
            }
            return null;
          }
        }
      }
    }
    return null;
  }
}
