import {
  ExtensionContext,
  workspace,
  languages,
  TextDocument,
  window,
  Uri,
} from 'vscode';
import * as fs from 'fs';

import { PathAliasCompletion, ImportFunctionCompletion } from './completion';
import { PathAliasDefinition } from './definition';
import { PathAliasTagDefinition } from './definition/tag';
import { AliasMap, StatInfo, AliasStatTree } from './completion/type';
import { existsSync, statSync, readdirSync } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { debounce, mostLikeAlias, normalizePath, getFileWithExt } from './util/common';
import { generateWatcher } from './util/watcher';
import { PathAliasCodeActionProvider } from './codeAction';
import { getAliasConfig } from './util/config';
import {
  PathAliasSignatureHelpProvider,
  SignatureHelpCollectItem
} from './signature';
import { Nullable } from './util/types';
import {
  IFunctionSignature,
  getFunctionSignatureFromFiles
} from './util/getSignatureFromFile';
import WebpackAliasSearcher from './moduleBundlerAlias/WebpackAliasSearcher';

const registerLanguages = [
  { language: 'javascript', scheme: 'file' },
  { language: 'javascriptreact', scheme: 'file' },
  { language: 'typescript', scheme: 'file' },
  { language: 'typescriptreact', scheme: 'file' },
  { language: 'vue', scheme: 'file' }
];

export const eventBus = new EventEmitter();
const isWin = process.platform === "win32";
export class PathAlias {
  private _ctx: ExtensionContext;
  private _statMap: AliasStatTree[] = [{}];
  private _aliasMap: AliasMap[] = [{}];
  private _completion!: PathAliasCompletion;
  private _definition!: PathAliasDefinition;
  private _codeAction!: PathAliasCodeActionProvider;
  private _tagDefinition!: PathAliasTagDefinition;
  private _signature!: PathAliasSignatureHelpProvider;
  private _aliasList: Array<string[]> = [];
  private _importAbsolutePathList: string[] = [];
  private _importAliasPathList: string[] = [];
  private _functionTokenList: SignatureHelpCollectItem[] = [];
  private _importCompletion!: ImportFunctionCompletion;
  constructor(ctx: ExtensionContext) {
    // console.time('init');
    this._ctx = ctx;
    
    this.init();

    if (workspace.workspaceFolders && workspace.getWorkspaceFolder.length) {
      workspace.workspaceFolders.forEach(ws => {
        generateWatcher(ws.uri.fsPath);
      });
    }
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pathAlias.aliasMap')) {
        this.updateStatInfo();
      }
    });
    window.onDidChangeActiveTextEditor(event => {
      if (event) {
        this.recollectDependencies(event.document);
      }
    });
    const handler = debounce(() => {
      this.updateStatInfo();
    }, 1000);
    eventBus
      .on('file-change', path => {
        const normalizedPath = isWin ? path.replace(/\\/g, '/') : path;
        const ws = workspace.getWorkspaceFolder(Uri.parse(`file://${normalizedPath}`));
        if (!ws) {
          return;
        }
        handler();
      })
      .on('recollect', (document: TextDocument) => {
        if (document) {
          this.recollectDependencies(document);
        }
      });
    // console.timeEnd('init');
  }

  private recollectDependencies(document: TextDocument) {
    this._functionTokenList = [];
    this._importAliasPathList = [];
    this._importAbsolutePathList = [];
    const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:('(?:.*)'|"(?:.*)"))/g;
    const content = document.getText();
    let execResult: Nullable<RegExpExecArray> = null;
    const ws = workspace.getWorkspaceFolder(document.uri);
    if (!ws) {
      return;
    }
    const index = ws.index;
    while ((execResult = importReg.exec(content))) {
      let [, , , pathAlias] = execResult;
      pathAlias = pathAlias.slice(1, -1);
      const mostLike = mostLikeAlias(this._aliasList[index], pathAlias.split('/')[0]);
      if (mostLike) {
        this._importAliasPathList.push(pathAlias);
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
          // console.time('ast');
          const absolutePathWithExtname = absolutePath + '.' + extname;
          // const file = fs.readFileSync(absolutePathWithExtname, {
          //   encoding: 'utf8'
          // }).toString();
          this._importAbsolutePathList.push(absolutePathWithExtname);
        }
      }
    }
    this._functionTokenList = getFunctionSignatureFromFiles(
      this._importAbsolutePathList
    );
    this._importCompletion.setFunctionTokenListAndPathList(
      this._functionTokenList,
      this._importAbsolutePathList,
      this._importAliasPathList
    );
    this._signature.setFunctionTokenList(
      this._functionTokenList.reduce(
        (pre, cur) => {
          return pre.concat(cur.functionTokenList);
        },
        <IFunctionSignature[]>[]
      )
    );
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
        registerLanguages,
        this._signature,
        ',',
        '('
      )
    );
  }

  private updateStatInfo() {
    this.initStatInfo();
    this._completion.setStatMapAndAliasList(this._statMap, this._aliasList);
    this._definition.setStatMapAndAliasList(this._statMap, this._aliasList);
    this._tagDefinition.setStatMapAndAliasList(this._statMap, this._aliasList);
  }

  private initStatInfo() {
    // 自动搜索webpack配置文件中的alias
    let was = new WebpackAliasSearcher(workspace.rootPath || '');
    this._aliasMap[0] = was.getDefaultAlias() || {};
    
    if (workspace.workspaceFolders && workspace.workspaceFolders.length) {
      this._statMap = workspace.workspaceFolders.map(_ => ({}));
      workspace.workspaceFolders.forEach((ws, index) => {
        this._aliasMap[index] = {
          ...this._aliasMap[index],
          ...workspace.getConfiguration('pathAlias').get('aliasMap') || {},
          ...getAliasConfig(ws.uri.fsPath || '')
        };
        Object.keys(this._aliasMap[index]).forEach(alias => {
          const realPath = this._aliasMap[index][alias].replace(
            '${cwd}',
            ws.uri.fsPath || ''
          );
          let absolutePath = getFileWithExt(realPath) || (existsSync(realPath) && statSync(realPath).isDirectory() && realPath);
          if (absolutePath) {
            this._statMap[index][alias] = aliasStatInfo(alias, absolutePath);
          }
        });
        this._aliasList[index] = Object.keys(this._aliasMap[index]).sort();
      });
    }
  }
  private initCodeAction() {
    this._codeAction = new PathAliasCodeActionProvider(this._statMap);
    this._ctx.subscriptions.push(
      languages.registerCodeActionsProvider(
        registerLanguages,
        this._codeAction
      )
    );
  }
  private initCompletion() {
    this._completion = new PathAliasCompletion(this._statMap, this._aliasList);
    this._importCompletion = new ImportFunctionCompletion();
    this._ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        registerLanguages,
        this._completion,
        '/',
        ',',
        '{'
      ),
      languages.registerCompletionItemProvider(
        registerLanguages,
        this._importCompletion
      )
    );
  }

  private initDefinition() {
    this._definition = new PathAliasDefinition(this._statMap, this._aliasList);
    this._tagDefinition = new PathAliasTagDefinition(
      this._statMap,
      this._aliasList
    );
    this._ctx.subscriptions.push(
      languages.registerDefinitionProvider(
        registerLanguages,
        this._definition
      ),
      languages.registerDefinitionProvider(
        [{ language: 'vue', scheme: 'file' }],
        this._tagDefinition
      )
    );
  }
}

function aliasStatInfo(alias: string, realPath: string): StatInfo {
  if (fs.existsSync(realPath) && fs.statSync(realPath).isFile()) {
    return aliasStatInfoFile(alias, realPath);
  }
  return aliasStatInfoDir(alias, realPath);
}

function aliasStatInfoFile(alias: string, realPath: string): StatInfo {
  const stat: StatInfo = {
    name: alias,
    type: 'file',
    absolutePath: realPath,
    children: Object.create(null)
  };
  return stat;
}

function aliasStatInfoDir(alias: string, realPath: string): StatInfo {
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
