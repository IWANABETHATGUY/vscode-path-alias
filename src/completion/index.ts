import * as path from 'path';
import {
  CompletionItemProvider,
  Position,
  CancellationToken,
  CompletionList,
  CompletionItem,
  CompletionContext,
  TextDocument,
  CompletionItemKind
} from 'vscode';
import { AliasMap, StatInfo } from './type';
import { existsSync, statSync, readdirSync } from 'fs';

export class PathAliasCompletion implements CompletionItemProvider {
  private _statMap: { [alias: string]: StatInfo } = {};
  constructor(aliasMap: AliasMap) {
    Object.keys(aliasMap).forEach(alias => {
      const realPath = aliasMap[alias];
      let isLegal = true;
      if (isLegal && !existsSync(realPath)) {
        console.warn(`${realPath} does not exist`);
        isLegal = false;
      } else if (isLegal && !path.isAbsolute(realPath)) {
        console.warn(`${realPath} is not a absolutePath`);
        isLegal = false;
      } else if (isLegal && !statSync(realPath).isDirectory()) {
        console.warn(`${realPath} is not a directory`);
        isLegal = false;
      }
      if (isLegal) {
        this._statMap[alias] = aliasStatInfo(alias, realPath);
      }
    });
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

function aliasStatInfo(alias: string, realPath: string): StatInfo {
  const stat: StatInfo = {
    name: alias,
    type: 'directory',
    absolutePath: realPath,
    children: Object.create(null)
  };
  stat['children'] = readdirSync(realPath).reduce((pre, currentPath) => {
    if (currentPath !== 'node_modules') {
      const absolutePath = path.resolve(realPath, currentPath);
      pre[currentPath] = getStatInfo(currentPath, absolutePath);
    }
    return pre;
  }, stat.children);
  return stat;
}

function getStatInfo(name: string, absolutePath: string): StatInfo {
  const resStatInfo: StatInfo = {
    name,
    absolutePath,
    type: 'file',
    children: Object.create(null)
  };
  if (statSync(absolutePath).isDirectory()) {
    resStatInfo['children'] = readdirSync(absolutePath).reduce(
      (pre, curName) => {
        if (curName !== 'node_modules') {
          pre[curName] = getStatInfo(
            curName,
            path.resolve(absolutePath, curName)
          );
        }
        return pre;
      },
      resStatInfo.children
    );
    resStatInfo['type'] = 'directory';
  }
  return resStatInfo;
}

function isObject(obj: any): obj is StatInfo {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
