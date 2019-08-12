import {
  DefinitionProvider,
  TextDocument,
  Position,
  CancellationToken,
  ProviderResult,
  Location,
  LocationLink,
  Disposable
} from 'vscode';
export class PathAliasDefinition implements DefinitionProvider {
  private _disposable: Disposable;
  constructor() {
    let subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
  }
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Location | Location[] | LocationLink[]> {
    return [];
  }
}
