import { ExtensionContext, workspace, languages } from 'vscode';
import { PathAliasCompletion } from './completion';
import { PathAliasDefinition } from './defination';
import { AliasMap, StatInfo, AliasStatTree } from './completion/type';
import { existsSync, statSync, readdirSync } from 'fs';
import * as path from 'path';
export class PathAlias {
  private _ctx: ExtensionContext;
  private _statMap: AliasStatTree = {};
  constructor(ctx: ExtensionContext) {
    this._ctx = ctx;
    this.init();
  }

  private init() {
    this.initStatInfo();
    this.initCompletion();
    this.initDefinition();
  }

  private initStatInfo() {
    const aliasMap: AliasMap = { '@': workspace.rootPath || '' };
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
  private initCompletion() {
    this._ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        new PathAliasCompletion(this._statMap),
        '/'
      )
    );
  }

  private initDefinition() {
    this._ctx.subscriptions.push(
      languages.registerDefinitionProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        new PathAliasDefinition(this._statMap)
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

