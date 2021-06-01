import {
  DefinitionProvider,
  TextDocument,
  Position,
  CancellationToken,
  ProviderResult,
  Location,
  LocationLink,
  Disposable,
  Uri,
} from 'vscode';
import { AliasStatTree, StatInfo } from '../completion/type';
import {
  isObject,
  mostLikeAlias,
  normalizePath,
  getIndexOfWorkspaceFolder,
} from '../util/common';
import * as path from 'path';
import * as fs from 'fs';
import { Nullable } from '../util/types';
import { traverse } from '../util/traverseSourceFile';
export class PathAliasDefinition implements DefinitionProvider {
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
    const reg = /\"(.*)\"|\'(.*)\'/;
    const range = document.getWordRangeAtPosition(position, reg);
    const index = getIndexOfWorkspaceFolder(document.uri);
    if (index === undefined) return null;
    if (range) {
      const inputPath = document.getText(range);
      const resPath = inputPath.slice(1, -1);
      const mostLike = mostLikeAlias(
        this._aliasList[index],
        resPath.split('/')[0]
      );

      if (mostLike) {
        let statInfo: StatInfo = this._statMap[index][mostLike];
        let splitPath = resPath.split('/').slice(1).filter(Boolean);
        const lastStatInfo = splitPath
          .slice(0, -1)
          .reduce((pre: Nullable<StatInfo>, cur) => {
            if (isObject(pre)) {
              pre = pre.children[cur];
              return pre;
            }
            return null;
          }, statInfo);
        const currentDocumentExt = path.extname(document.uri.path);

        if (lastStatInfo) {
          let lastPath = lastStatInfo.children[splitPath[splitPath.length - 1]];
          if (lastPath || lastStatInfo.type === 'directory') {
            if (lastPath && lastPath.type === 'file') {
              return new Location(
                Uri.file(lastPath.absolutePath),
                new Position(0, 0)
              );
            }  {
              // if path has no base string, only dir name
              if (lastPath && lastPath.type === 'directory') {
                let extensionList = [`${currentDocumentExt}`, '.js'];
                for (let i = 0; i < extensionList.length; i++) {
                  const extension = extensionList[i];
                  const tryAddIndexFileToPath = path.resolve(
                    lastPath.absolutePath,
                    `index${extension}`
                  );
                  if (fs.existsSync(tryAddIndexFileToPath)) {
                    return new Location(
                      Uri.file(tryAddIndexFileToPath),
                      new Position(0, 0)
                    );
                  }
                }
                
              } else {
                lastPath = lastStatInfo
                // here the absolute path has base string, try to add extension
                const basename = path.basename(resPath);
                let extensionList = [`${currentDocumentExt}`, '.js'];
                for (let i = 0; i < extensionList.length; i++) {
                  const extension = extensionList[i];
                  const tryAddIndexFileToPath = path.resolve(
                    lastPath.absolutePath,
                    `${basename}${extension}`
                  );
                  if (fs.existsSync(tryAddIndexFileToPath)) {
                    return new Location(
                      Uri.file(tryAddIndexFileToPath),
                      new Position(0, 0)
                    );
                  }
                }
              }
            }
          } else {
            const lastPathDir = lastStatInfo.absolutePath;
            const lastPathString = splitPath[splitPath.length - 1] || '';
            const lastPathPrefix = path.resolve(lastPathDir, lastPathString);
            const currentDocumentTypePath = lastPathPrefix + currentDocumentExt;
            const JsTypePath = lastPathPrefix + '.js';
            if (fs.existsSync(currentDocumentTypePath)) {
              return new Location(
                Uri.file(currentDocumentTypePath),
                new Position(0, 0)
              );
            } else if (fs.existsSync(JsTypePath)) {
              return new Location(Uri.file(JsTypePath), new Position(0, 0));
            }
            return null;
          }
        }
      }
    } else {
      return this.importDefinition(document, position);
    }
    return null;
  }

  private importDefinition(document: TextDocument, position: Position) {
    const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:('(?:.*)'|"(?:.*)"))/g;
    const content = document.getText();
    const zeroBasedPosition = document.offsetAt(position);
    const wsIndex = getIndexOfWorkspaceFolder(document.uri);
    if (wsIndex === undefined) return null;
    console.time('reg');
    let execResult: Nullable<RegExpExecArray> = null;
    while ((execResult = importReg.exec(content))) {
      const [, beforeLeftBrace, importIdentifiers] = execResult;
      const index = execResult.index;
      const leftBrachStart = index + beforeLeftBrace.length;
      if (
        zeroBasedPosition > leftBrachStart &&
        zeroBasedPosition <= leftBrachStart + importIdentifiers.length + 1
      ) {
        break;
      }
    }
    console.timeEnd('reg');
    if (execResult) {
      const reg = /\w+/;
      const wordRange = document.getWordRangeAtPosition(position, reg);
      if (!wordRange) {
        return null;
      }
      const word = document.getText(wordRange);
      let [, , , pathAlias] = execResult;
      pathAlias = pathAlias.slice(1, -1);
      const mostLike = mostLikeAlias(
        this._aliasList[wsIndex],
        pathAlias.split('/')[0]
      );
      if (mostLike) {
        const pathList = [
          this._statMap[wsIndex][mostLike]['absolutePath'],
          ...pathAlias.split('/').slice(1),
        ];
        let absolutePath = path.join(...pathList);
        let extname = path.extname(absolutePath);
        if (!extname) {
          if (fs.existsSync(`${absolutePath}.js`)) {
            extname = 'js';
          } else if (fs.existsSync(`${absolutePath}.ts`)) {
            extname = 'ts';
          } else if (fs.existsSync(normalizePath(absolutePath))) {
            absolutePath += '/index';
            extname = 'js';
          }
        }
        if (extname === 'js' || extname === 'ts') {
          console.time('ast');
          const absolutePathWithExtname = absolutePath + '.' + extname;
          const file = fs.readFileSync(absolutePathWithExtname, {
            encoding: 'utf8',
          });
          // 这里是已经导入的函数或变量
          const exportIdentifierList = traverse(absolutePathWithExtname, file);
          const retDefinition = exportIdentifierList.filter(
            (token) => token.identifier === word
          )[0];
          console.timeEnd('ast');
          if (retDefinition) {
            return new Location(
              Uri.file(absolutePathWithExtname),
              new Position(
                retDefinition.position.line,
                retDefinition.position.character
              )
            );
          }
        }
      }
    }
  }
}