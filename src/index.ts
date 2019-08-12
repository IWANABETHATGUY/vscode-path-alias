import { ExtensionContext, workspace, languages } from 'vscode';
import { PathAliasCompletion } from './completion';
export class PathAlias {
  private _ctx: ExtensionContext;
  constructor(ctx: ExtensionContext) {
    this._ctx = ctx;
    this.init();
  }

  private init() {
    this.initCompletion();
    this.initDefinition();
  }

  private initCompletion() {
    this._ctx.subscriptions.push(
      languages.registerCompletionItemProvider(
        [
          { language: 'javascript', scheme: 'file' },
          { language: 'vue', scheme: 'file' }
        ],
        new PathAliasCompletion({ '@': workspace.rootPath || '' }),
        '/'
      )
    );
  }

  private initDefinition() {}
}
