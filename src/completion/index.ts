import {
  CompletionItemProvider,
  Position,
  CancellationToken,
  CompletionList,
  CompletionItem,
  CompletionContext,
  TextDocument,
  CompletionItemKind,
  Disposable
} from 'vscode';
import { StatInfo, AliasStatTree } from './type';
import { isObject } from '../util/common';

export class PathAliasCompletion implements CompletionItemProvider {
  
  private _statMap: AliasStatTree;
  private _disposable: Disposable;
  constructor(statMap: AliasStatTree) {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
    this._statMap = statMap;
    
  }

  dispose() {
    this._disposable.dispose()
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
      if (resPath.startsWith('@')) {
        let statInfo: StatInfo = this._statMap['@'];
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

        if (lastPath) {
          const children = lastPath.children;
          const retCompletionList = Object.keys(children).map(key => {
            const curStatInfo = children[key];
            const completionItem = new CompletionItem(key);
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


