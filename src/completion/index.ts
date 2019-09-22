import {
  CompletionItemProvider,
  Position,
  CancellationToken,
  CompletionList,
  CompletionItem,
  CompletionContext,
  TextDocument,
  CompletionItemKind,
  Disposable,
  workspace
} from 'vscode';
import { StatInfo, AliasStatTree } from './type';
import { isObject, mostLikeAlias } from '../util/common';
import * as path from 'path';
import { Nullable } from '../util/types';
import * as fs from 'fs';
import { traverse } from '../util/traverseSourceFile';
export class PathAliasCompletion implements CompletionItemProvider {
  private _aliasList: string[] = [];
  private _statMap!: AliasStatTree;
  private _disposable: Disposable;
  private _needExtension: boolean = true;
  constructor(statMap: AliasStatTree) {
    let subscriptions: Disposable[] = [];
    this._needExtension = !!workspace
      .getConfiguration('pathAlias')
      .get('needExtension');
    this.setStatMap(statMap);
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pathAlias.needExtension')) {
        this._needExtension = !!workspace
          .getConfiguration('pathAlias')
          .get('needExtension');
      }
    });
    this._disposable = Disposable.from(...subscriptions);
  }
  setStatMap(statMap: AliasStatTree) {
    this._statMap = statMap;
    this._aliasList = Object.keys(this._statMap).sort();
  }
  dispose() {
    this._disposable.dispose();
  }
  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext
  ): Promise<CompletionItem[] | CompletionList> {
    const completionList: CompletionItem[] = [];
    const aliasReg = /\"(.*)\"|\'(.*)\'/;
    const importReg = /import\s*{([^{}]*)}\s*from\s*(?:(?:'(.*)'|"(.*)"))/;
    const importRange = document.getWordRangeAtPosition(position, importReg);
    const range = document.getWordRangeAtPosition(position, aliasReg);
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
        const lastPath = splitPath.reduce((pre: Nullable<StatInfo>, cur) => {
          if (isObject(pre)) {
            pre = pre.children[cur];
            return pre;
          }
          return null;
        }, statInfo);

        if (lastPath) {
          const children = lastPath.children;
          const retCompletionList = Object.keys(children).map(key => {
            const curStatInfo = children[key];
            const completionItem = new CompletionItem(key);
            if (curStatInfo.type === 'file' && !this._needExtension) {
              completionItem.insertText = key.split('.')[0];
            }
            completionItem.kind =
              curStatInfo.type === 'directory'
                ? CompletionItemKind.Folder
                : CompletionItemKind.File;
            return completionItem;
          });
          completionList.push(...retCompletionList);
        }
      }
    } else if (importRange) {
      const [, , pathAlias] = importReg.exec(document.getText(importRange))!;
      const mostLike = mostLikeAlias(this._aliasList, pathAlias.split('/')[0]);
      if (mostLike) {
        const pathList = [
          this._statMap[mostLike]['absolutePath'],
          ...pathAlias.split('/').slice(1)
        ];
        const absolutePath = path.join(...pathList);
        let extname = path.extname(absolutePath);
        if (!extname) {
          if (fs.existsSync(`${absolutePath}.js`)) {
            extname = 'js';
          } else if (fs.existsSync(`${absolutePath}.ts`)) {
            extname = 'ts';
          }
        }
        if (extname === 'js' || extname === 'ts') {
          const absolutePathWithExtname = absolutePath + '.' + extname;
          const file = fs.readFileSync(absolutePathWithExtname, {
            encoding: 'utf8'
          });
          const exportIdentifierList = traverse(absolutePathWithExtname, file);
          const retCompletionList = exportIdentifierList.map(id => {
            const completionItem = new CompletionItem(id);
            // TODO: 这里需要具体细化是函数还是变量
            completionItem.kind = CompletionItemKind.Function;
            return completionItem;
          });
          completionList.push(...retCompletionList);
        }
      }
    }

    return completionList;
  }
}
