import { ExtensionContext, workspace, languages } from 'vscode';
import { PathAliasCompletion } from './completion';
import { PathAliasDefinition } from './defination';
import { AliasMap, StatInfo, AliasStatTree } from './completion/type';
import { existsSync, statSync, readdirSync } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { debounce } from './util/common';
import { generateWatcher } from './util/watcher';
export const eventBus = new EventEmitter();

export class PathAlias {
  private _ctx: ExtensionContext;
  private _statMap: AliasStatTree = {};
  private _aliasMap: AliasMap = {};
  private _completion!: PathAliasCompletion;
  private _defination!: PathAliasDefinition;
  // private _fileWatcher: chokidar.FSWatcher | null = null;
  constructor(ctx: ExtensionContext) {
    console.time('init');
    this._ctx = ctx;
    this.init();
    if (workspace.rootPath) {
      //TODO:当改变了文件目录时，需要重新初始化
      generateWatcher(workspace.rootPath);
    }
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pathAlias.aliasMap')) {
        this.updateStatInfo();
      }
    });
    const handler = debounce(() => {
      console.log('change');
      this.updateStatInfo()
    }, 1000);
    eventBus.on('file-change', (path)=> {
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
    });
    console.timeEnd('init')
  }

  private init() {
    this.initStatInfo();
    this.initCompletion();
    this.initDefinition();
  }

  private updateStatInfo() {
    this.initStatInfo();
    this._completion.setStatMap(this._statMap);
    this._defination.setStatMap(this._statMap);
  }

  private initStatInfo() {
    this._aliasMap =
      workspace.getConfiguration('pathAlias').get('aliasMap') || {};

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
  }
  private initCompletion() {
    this._completion = new PathAliasCompletion(this._statMap);

    this._ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        this._completion,
        '/'
      )
    );
  }

  private initDefinition() {
    this._defination = new PathAliasDefinition(this._statMap);

    this._ctx.subscriptions.push(
      languages.registerDefinitionProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        this._defination
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
