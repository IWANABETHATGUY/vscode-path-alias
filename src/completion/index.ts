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
import { Nullable } from '../util/types'
export class PathAliasCompletion implements CompletionItemProvider {
  private _aliasList: string[] = [];
  private _statMap!: AliasStatTree;
  private _disposable: Disposable;
  private _needExtension: boolean = true;
  constructor(statMap: AliasStatTree) {
    let subscriptions: Disposable[] = [];
    this._needExtension = !!workspace.getConfiguration('pathAlias').get('needExtension');
    this.setStatMap(statMap);
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pathAlias.needExtension')) {
        this._needExtension = !!workspace.getConfiguration('pathAlias').get('needExtension');
      }
    })
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
    }

    return completionList;
  }
}
