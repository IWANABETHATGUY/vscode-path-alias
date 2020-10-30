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
  EndOfLine
} from 'vscode';
import { StatInfo, AliasStatTree } from './type';
import {
  isObject,
  mostLikeAlias,
  normalizePath,
  getIndexOfWorkspaceFolder
} from '../util/common';
import * as path from 'path';
import { Nullable } from '../util/types';
import * as fs from 'fs';
import { traverse } from '../util/traverseSourceFile';
import { SignatureHelpCollectItem } from '../signature';
export class PathAliasCompletion implements CompletionItemProvider {
  private _aliasList: string[][] = [];
  private _statMap!: AliasStatTree[];
  private _disposable: Disposable;
  private _ignoreExtensionList: string[];
  private _needExtension: boolean = true;
  private _autoSuggestion: boolean;
  constructor(statMap: AliasStatTree[], aliasList: string[][]) {
    let subscriptions: Disposable[] = [];
    this._needExtension = !!workspace
      .getConfiguration('pathAlias')
      .get('needExtension');
    this._autoSuggestion = !!workspace
      .getConfiguration('pathAlias')
      .get('autoSuggestion');
    this._ignoreExtensionList =
      workspace.getConfiguration('pathAlias').get('ignoreExtensionList') || [];
    this.setStatMapAndAliasList(statMap, aliasList);
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
      if (e.affectsConfiguration('pathAlias.autoSuggestion')) {
        this._autoSuggestion = !!workspace
          .getConfiguration('pathAlias')
          .get('autoSuggestion');
      }
    });
    this._disposable = Disposable.from(...subscriptions);
  }
  setStatMapAndAliasList(statMap: AliasStatTree[], aliasList: string[][]) {
    this._statMap = statMap;
    this._aliasList = aliasList;
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
    // console.time('completion');
    const aliasReg = /\"(.*?)\"|\'(.*?)\'/;
    const range = document.getWordRangeAtPosition(position, aliasReg);
    const index = getIndexOfWorkspaceFolder(document.uri);
    if (index === undefined) return completionList;
    if (range) {
      const inputPath = document.getText(range);
      const resPath = inputPath.slice(1, -1);
      const mostLike = mostLikeAlias(
        this._aliasList[index],
        resPath.split('/')[0]
      );
      if (mostLike) {
        let statInfo: StatInfo = this._statMap[index][mostLike];
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
            if (curStatInfo.type !== 'file' && this._autoSuggestion) {
              completionItem.label += '/';
              completionItem.command = {
                command: 'editor.action.triggerSuggest',
                title: 'Trigger Suggest'
              };
            }
            return completionItem;
          });
          completionList.push(...retCompletionList);
        }
      }
    } else {
      completionList.push(...this.importCompletion(document, position));
    }
    // console.timeEnd('completion');

    return completionList;
  }
  private importCompletion(
    document: TextDocument,
    position: Position
  ): CompletionItem[] {
    const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:('(?:.*)'|"(?:.*)"))/g;
    const content = document.getText();
    const zeroBasedPosition = document.offsetAt(position);
    const completionList: CompletionItem[] = [];
    const index = getIndexOfWorkspaceFolder(document.uri);
    if (index === undefined) return completionList;
    // console.time('reg');
    let execResult: Nullable<RegExpExecArray> = null;
    while (execResult = importReg.exec(content)) {
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
      let [, , importIdentifiers, pathAlias] = execResult;
      pathAlias = pathAlias.slice(1, -1);
      const mostLike = mostLikeAlias(
        this._aliasList[index],
        pathAlias.split('/')[0]
      );
      if (mostLike) {
        const pathList = [
          this._statMap[index][mostLike]['absolutePath'],
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

export class ImportFunctionCompletion implements CompletionItemProvider {
  private _disposable: Disposable;
  private _functionTokenList: SignatureHelpCollectItem[] = [];
  private _absoluteToAliasMap: Map<string, string> = new Map();
  constructor() {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
  }

  setFunctionTokenListAndPathList(
    functionTokenList: SignatureHelpCollectItem[],
    absolutePathList: string[],
    aliasPathList: string[]
  ) {
    this._absoluteToAliasMap.clear();
    this._functionTokenList = functionTokenList;
    for (let i = 0; i < absolutePathList.length; i++) {
      this._absoluteToAliasMap.set(absolutePathList[i], aliasPathList[i]);
    }
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
    console.time('completion');
    // const aliasReg = /\"(.*?)\"|\'(.*?)\'/;
    const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:('(?:.*)'|"(?:.*)"))/g;
    const content = document.getText();
    const completionList: CompletionItem[] = [];
    console.time('reg');
    const aliasInfoMap: Map<
      string,
      { braceEnd: number; empty: boolean }
    > = new Map();
    let execResult: Nullable<RegExpExecArray> = null;
    const importIdentifierSet: Set<string> = new Set();
    while ((execResult = importReg.exec(content))) {
      let empty = true;
      let [, beforeLeftBrace, importIdentifiers, pathAlias] = execResult;
      pathAlias = pathAlias.slice(1, -1);
      const index = execResult.index;
      const braceEnd =
        index + beforeLeftBrace.length + importIdentifiers.length + 1;

      importIdentifiers.split(',').forEach(identifier => {
        const normalizedIdentifier = identifier.trim();
        if (normalizedIdentifier) {
          importIdentifierSet.add(identifier.trim());
          if (empty) {
            empty = false;
          }
        }
      });
      aliasInfoMap.set(pathAlias, {
        braceEnd,
        empty
      });
    }
    const range = document.getWordRangeAtPosition(position);
    // debugger;
    if (range) {
      // const callerToken = document.getText(range);
      const signatureHelpCollectList = this._functionTokenList;
      for (let i = 0, length = signatureHelpCollectList.length; i < length; i++) {
        const item = signatureHelpCollectList[i].functionTokenList;
        const path = signatureHelpCollectList[i].id;
        const aliasPath = this._absoluteToAliasMap.get(path);
        let zeroBasedPosition;
        let info;
        let insertRange: Nullable<Range> = null;
        if (aliasPath) {
          info = aliasInfoMap.get(aliasPath);
          if (info) {
            zeroBasedPosition = info.braceEnd;
          }
          if (zeroBasedPosition !== undefined) {
            insertRange = new Range(
              document.positionAt(zeroBasedPosition),
              document.positionAt(zeroBasedPosition)
            );
          }
        }
        for (let j = 0, len = item.length; j < len; j++) {
          if (importIdentifierSet.has(item[j].name!)) {
            continue;
          }
          const completionItem = new CompletionItem(item[j].name!);
          completionItem.kind = CompletionItemKind.Function;
          completionItem.documentation = item[j].documentation!;
          completionItem.detail = `从 ${path} 自动导入\n${item[j].type}`;
          completionList.push(completionItem);
          if (info && insertRange) {
            completionItem.additionalTextEdits = [
              {
                newText: `${info.empty ? '' : ','} ${item[j].name!}`,
                range: insertRange,
                newEol: EndOfLine.LF
              }
            ];
          }
        }
      }
    }
    console.timeEnd('completion');

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
