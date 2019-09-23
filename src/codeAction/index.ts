import {
  CodeActionProvider,
  TextDocument,
  Range,
  CodeActionContext,
  CancellationToken,
  Disposable,
  CodeAction,
  CodeActionKind,
  WorkspaceEdit
} from 'vscode';
import { AliasStatTree } from '../completion/type';
import { resolve, dirname } from 'path';

export class PathAliasCodeActionProvider implements CodeActionProvider {
  private _disposable: Disposable;
  private _statMap!: AliasStatTree;

  constructor(statMap: AliasStatTree) {
    const subscription: Disposable[] = [];
    this._disposable = Disposable.from(...subscription);
    this.setStatMap(statMap);
  }

  dispose() {
    this._disposable.dispose();
  }
  setStatMap(statMap: AliasStatTree) {
    this._statMap = statMap;
  }
  public async provideCodeActions(
    document: TextDocument,
    range: Range,
    context: CodeActionContext,
    token: CancellationToken
  ): Promise<CodeAction[]> {
    await sleep(100);
    const ret: CodeAction[] = [];
    if (range.isEmpty) {
      const reg = /\"(.*)\"|\'(.*)\'/;
      const position = range.start;
      const pathRange = document.getWordRangeAtPosition(position, reg);
      if (pathRange) {
        const inputPath = document.getText(pathRange);
        const resPath = inputPath.slice(1, -1);
        if (isRelativePath(resPath)) {
          const absolutePath = resolve(dirname(document.fileName), resPath);
          Object.entries(this._statMap).forEach(([alias, stat]) => {
            const alias2AbsolutePath = stat['absolutePath'];
            if (absolutePath.startsWith(alias2AbsolutePath)) {
              const insertPath = absolutePath.replace(alias2AbsolutePath, alias);
              const action = new CodeAction(insertPath);
              action.kind = CodeActionKind.Refactor
              action.edit = new WorkspaceEdit();
              action.edit.replace(document.uri, pathRange, `'${insertPath}'`);
              ret.push(action);
            }
          })
        }
      }
    }
    return ret;
  }
}

function sleep(time: number): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

function isRelativePath(path: string): boolean {
  return path.startsWith('./') || path.startsWith('../');
}
