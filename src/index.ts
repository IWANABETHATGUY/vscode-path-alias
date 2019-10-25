import { ExtensionContext, workspace, languages, TextDocument, window } from 'vscode';
import * as fs from 'fs';

import { PathAliasCompletion } from './completion';
import { PathAliasDefinition } from './defination';
import { PathAliasTagDefinition } from './defination/tag';
import { AliasMap, StatInfo, AliasStatTree } from './completion/type';
import { existsSync, statSync, readdirSync } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { debounce, mostLikeAlias, normalizePath } from './util/common';
import { generateWatcher } from './util/watcher';
import { PathAliasCodeActionProvider } from './codeAction';
import { getAliasConfig } from './util/config';
import { PathAliasSignatureHelpProvider } from './signature';
import { Nullable } from './util/types';
import { IFunctionSignature, getFuncitonSignatureFromFiles } from './util/getSignatureFromFile';

export const eventBus = new EventEmitter();
export class PathAlias {
  private _ctx: ExtensionContext;
  private _statMap: AliasStatTree = {};
  private _aliasMap: AliasMap = {};
  private _completion!: PathAliasCompletion;
  private _defination!: PathAliasDefinition;
  private _codeAction!: PathAliasCodeActionProvider;
  private _tagDefination!: PathAliasTagDefinition;
  private _signature!: PathAliasSignatureHelpProvider;
  private _aliasList: string[] = [];
  private _absolutePathList: string[] = [];
  private _aliasPathList: string[] = [];
  private _functionTokenList: IFunctionSignature[] = [];
  constructor(ctx: ExtensionContext) {
    console.time('init');
    this._ctx = ctx;
    this.init();
    if (workspace.rootPath) {
      generateWatcher(workspace.rootPath);
    }
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pathAlias.aliasMap')) {
        this.updateStatInfo();
      }
    });
    window.onDidChangeActiveTextEditor(event => {
      if (event) {
        this.recollectDeppendencies(event.document);
      }
    });
    const handler = debounce(() => {
      this.updateStatInfo();
    }, 1000);
    eventBus.on('file-change', path => {
      const needToRestart = Object.keys(this._aliasMap)
        .map(key => {
          return this._aliasMap[key].replace(
            '${cwd}',
            workspace.rootPath || ''
          );
        })
        .some(aliasPath => {
          return path.startsWith(aliasPath);
        });
      if (needToRestart) {
        handler();
      }
    }).on('recollect', (document: TextDocument) => {
      if (document) {
        this.recollectDeppendencies(document);
      }
    })
    console.timeEnd('init');
  }

  private recollectDeppendencies(document: TextDocument) {
    this._functionTokenList = [];
    this._aliasPathList = [];
    this._absolutePathList = [];
    const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:(?:'(.*)'|"(.*)"))/g;
    const content = document.getText();
    let execResult: Nullable<RegExpExecArray> = null;
    while ((execResult = importReg.exec(content))) {
      const [, , , pathAlias] = execResult;
      this._aliasPathList.push(pathAlias);
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
          // const file = fs.readFileSync(absolutePathWithExtname, {
          //   encoding: 'utf8'
          // }).toString();
          this._absolutePathList.push(absolutePathWithExtname);
        }
      }
    }
    this._functionTokenList = getFuncitonSignatureFromFiles(this._absolutePathList);
    this._signature.setFunctionTokenList(this._functionTokenList);
    
  }
  
  private init() {
    this.initStatInfo();
    this.initCompletion();
    this.initDefinition();
    this.initCodeAction();
    this.initSignature();
  }

  private initSignature() {
    this._signature = new PathAliasSignatureHelpProvider();
    this._ctx.subscriptions.push(
      languages.registerSignatureHelpProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        this._signature,
        ',',
        '('
      )
    );
  }

  private updateStatInfo() {
    this.initStatInfo();
    this._completion.setStatMapAndAliasList(this._statMap, this._aliasList);
    this._defination.setStatMapAndAliasList(this._statMap, this._aliasList);
    this._tagDefination.setStatMapAndAliasList(this._statMap, this._aliasList);
  }

  private initStatInfo() {
    this._aliasMap =
      workspace.getConfiguration('pathAlias').get('aliasMap') || {};
    this._aliasMap = {
      ...this._aliasMap,
      ...getAliasConfig(workspace.rootPath || '')
    };
    Object.keys(this._aliasMap).forEach(alias => {
      const realPath = this._aliasMap[alias].replace(
        '${cwd}',
        workspace.rootPath || ''
      );
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
    this._aliasList = Object.keys(this._aliasMap).sort();
  }
  private initCodeAction() {
    this._codeAction = new PathAliasCodeActionProvider(this._statMap);
    this._ctx.subscriptions.push(
      languages.registerCodeActionsProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        this._codeAction
      )
    );
  }
  private initCompletion() {
    this._completion = new PathAliasCompletion(this._statMap, this._aliasList);

    this._ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        this._completion,
        '/',
        ',',
        '{'
      )
    );
  }

  private initDefinition() {
    this._defination = new PathAliasDefinition(this._statMap, this._aliasList);
    this._tagDefination = new PathAliasTagDefinition(this._statMap, this._aliasList);
    this._ctx.subscriptions.push(
      languages.registerDefinitionProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        this._defination
      ),
      languages.registerDefinitionProvider(
        [{ language: 'vue', scheme: 'file' }],
        this._tagDefination
      )
    );
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
