import * as fs from 'fs';
import * as path from 'path';
import {
  CancellationToken,
  DefinitionProvider,
  Disposable,
  Location,
  LocationLink,
  Position,
  ProviderResult,
  TextDocument,
  Uri,
} from 'vscode';
import { AliasStatTree, StatInfo } from '../completion/type';
import {
  getFileAbsolutePath,
  getIndexOfWorkspaceFolder,
  mostLikeAlias,
} from '../util/common';
import { traverse } from '../util/traverseSourceFile';

export class PathAliasDefinition implements DefinitionProvider {
  private _statMap!: AliasStatTree[];
  private _disposable: Disposable;
  private _aliasList: string[][] = [];
  constructor(statMap: AliasStatTree[], aliasList: string[][]) {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
    this.setStatMapAndAliasList(statMap, aliasList);
  }
  dispose() {
    this._disposable.dispose();
  }
  setStatMapAndAliasList(statMap: AliasStatTree[], aliasList: string[][]) {
    this._statMap = statMap;
    this._aliasList = aliasList;
  }
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Location | Location[] | LocationLink[]> {
    const index = getIndexOfWorkspaceFolder(document.uri);
    let fileAbsolutePath;
    let defination;
    if (index === undefined) return null;
    const textLine = document.lineAt(position.line);
    const [, p1, p2] = [...(/\"(.*)\"|\'(.*)\'/g.exec(textLine.text) || [])];
    const resPath = p1 || p2;
    const mostLike = mostLikeAlias(
      this._aliasList[index],
      resPath.split('/')[0]
    );

    // 如果没有别名，则不处理
    if (!mostLike) return null;
    let statInfo: StatInfo = this._statMap[index][mostLike];
    let splitPath = resPath.split('/').slice(1).filter(Boolean);
    const filePath = path.join(statInfo.absolutePath, ...splitPath);
    fileAbsolutePath = getFileAbsolutePath(filePath);

    const range = document.getWordRangeAtPosition(
      position,
      /\"(.*)\"|\'(.*)\'/
    );
    // 解析ast语法，获得export的位置
    if (!range && fileAbsolutePath) {
      defination = this.getImportDefination(
        document,
        position,
        fileAbsolutePath
      );
    }

    // 跳转到对应文件，对应位置
    if (fileAbsolutePath) {
      return new Location(
        Uri.file(fileAbsolutePath),
        new Position(
          defination?.position?.line || 0,
          defination?.position?.character || 0
        )
      );
    }
    return null;
  }

  // 解析ast语法，跳转到导出位置
  private getImportDefination(
    document: TextDocument,
    position: Position,
    fileAbsolutePath: string
  ) {
    console.time('ast');
    const file = fs.readFileSync(fileAbsolutePath, {
      encoding: 'utf8',
    });
    // 用于判断是否是默认导出情况
    const wordAndBracket = document.getWordRangeAtPosition(
      position,
      /\{[\s\S]*\w+[\s\S]*\}/g
    );
    const wordRange = document.getWordRangeAtPosition(position, /\w+/g);
    // 没有找到导出的情况不跳转
    if (!wordRange && !wordAndBracket) {
      return null;
    }
    const word = !wordAndBracket ? 'default' : document.getText(wordRange);
    // 这里是已经导入的函数或变量
    const exportIdentifierList = traverse(fileAbsolutePath, file);
    const defination = exportIdentifierList.filter(
      (token) => token.identifier === word
    )[0];
    console.timeEnd('ast');
    return defination;
  }
}
