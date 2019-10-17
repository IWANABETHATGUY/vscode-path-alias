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
  workspace,
  Range,
} from 'vscode';

import { StatInfo, AliasStatTree } from './type';
import { isObject, mostLikeAlias, normalizePath } from '../util/common';
import * as path from 'path';
import { Nullable } from '../util/types';
import * as fs from 'fs';
import { traverse } from '../util/traverseSourceFile';
export class PathAliasCompletion implements CompletionItemProvider {
  private _aliasList: string[] = [];
  private _statMap!: AliasStatTree;
  private _disposable: Disposable;
  private _ignoreExtensionList: string[];
  private _needExtension: boolean = true;
  constructor(statMap: AliasStatTree) {
    let subscriptions: Disposable[] = [];
    this._needExtension = !!workspace
      .getConfiguration('pathAlias')
      .get('needExtension');
    this._ignoreExtensionList =
      workspace.getConfiguration('pathAlias').get('ignoreExtensionList') || [];
    this.setStatMap(statMap);
    // 当配置更新时，查看pathalias 配置有相关更新
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pathAlias.needExtension')) {
        this._needExtension = !!workspace
          .getConfiguration('pathAlias')
          .get('needExtension');
      }
      if (e.affectsConfiguration('pathAlias.ignoreExtensionList')) {
        this._ignoreExtensionList =
          workspace.getConfiguration('pathAlias').get('ignoreExtensionList') ||
          [];
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
    console.time('completion');
    const aliasReg = /\"(.*?)\"|\'(.*?)\'/;

    const range = document.getWordRangeAtPosition(position, aliasReg);
    // debugger;
    if (range) {
      const inputPath = document.getText(range);
      const resPath = inputPath.slice(1, -1);
      const mostLike = mostLikeAlias(this._aliasList, resPath.split('/')[0]);
      if (mostLike) {
        let statInfo: StatInfo = this._statMap[mostLike];
        let prefixPathList: string[] = [];
        let insertPath = '';
        resPath.split('/').forEach((path, index, array) => {
          if (index > 0 && index < array.length - 1) {
            prefixPathList.push(path);
          } else if (index === array.length - 1) {
            insertPath = path;
          }
        });
        const lastPath = prefixPathList.reduce(
          (pre: Nullable<StatInfo>, cur) => {
            if (isObject(pre)) {
              pre = pre.children[cur];
              return pre;
            }
            return null;
          },
          statInfo
        );
        // debugger
        if (lastPath) {
          const children = lastPath.children;
          const retCompletionList = Object.keys(children).map(key => {
            const curStatInfo = children[key];
            const completionItem = new CompletionItem(key);
            // debugger
            const replaceRange = getInserPathRange(
              range,
              document,
              insertPath.length
            );
            completionItem.range = replaceRange;
            const splitList = key.split('.');
            const basename = splitList.slice(0, -1).join('.');
            const extension = splitList[splitList.length - 1];
            if (
              curStatInfo.type === 'file' &&
              !this._needExtension &&
              this._ignoreExtensionList.indexOf(extension) > -1
            ) {
              completionItem.insertText = basename;
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
    } else {
      completionList.push(...this.importCompletion(document, position));
    }
    console.timeEnd('completion');

    return completionList;
  }
  private importCompletion(
    document: TextDocument,
    position: Position,
  ): CompletionItem[] {
    const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:(?:'(.*)'|"(.*)"))/g;
    const content = document.getText();
    const zeroBasedPosition = document.offsetAt(position);
    const completionList: CompletionItem[] = [];
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
      const [, , importIdentifiers, pathAlias] = execResult;
      const mostLike = mostLikeAlias(this._aliasList, pathAlias.split('/')[0]);
      if (mostLike) {
        const pathList = [
          this._statMap[mostLike]['absolutePath'],
          ...pathAlias.split('/').slice(1)
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
            encoding: 'utf8'
          });
          // 这里是已经导入的函数或变量
          const importIdentifierList = importIdentifiers
            .split(',')
            .filter(Boolean)
            .map(id => id.trim());
          const exportIdentifierList = traverse(absolutePathWithExtname, file);
          console.timeEnd('ast');

          const retCompletionList = exportIdentifierList
            .filter(
              token => importIdentifierList.indexOf(token.identifier) === -1
            )
            .map(token => {
              const completionItem = new CompletionItem(token.identifier);
              completionItem.sortText = `0${token.identifier}`;
              completionItem.kind =
                token.kind === 'function'
                  ? CompletionItemKind.Function
                  : CompletionItemKind.Property;
              completionItem.documentation = token.description;
              return completionItem;
            });
          completionList.push(...retCompletionList);
        }
      }
    }
    return completionList;
  }
}

function getInserPathRange(
  range: Range,
  document: TextDocument,
  length: number
): Range {
  const numberOfEndPoint = document.offsetAt(range.end);
  const end = document.positionAt(numberOfEndPoint - 1);
  const start = document.positionAt(numberOfEndPoint - length - 1);
  return new Range(start, end);
}
