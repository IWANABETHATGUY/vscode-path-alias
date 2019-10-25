import {
  SignatureHelpProvider,
  SignatureHelp,
  TextDocument,
  Position,
  CancellationToken,
  Disposable,
  SignatureInformation,
  ParameterInformation
} from 'vscode';
import { Nullable } from '../util/types';
import { IFunctionSignature,  } from '../util/getSignatureFromFile';
import { eventBus } from '..';
export interface SignatureHelpMap {
  id: string;
  [prop: string]: string[] | string;
}

export class PathAliasSignatureHelpProvider implements SignatureHelpProvider {
  private _disposable: Disposable;
  private _functionTokenList: IFunctionSignature[] = [];
  private _importAliasPathList: string[] = [];
  constructor() {
    const subscriptions: Disposable[] = [];
    this._disposable = Disposable.from(...subscriptions);
  }

  dispose() {
    this._disposable.dispose();
  }

  public setFunctionTokenList(functionList: IFunctionSignature[]) {
    this._functionTokenList = functionList;
  }

  public async provideSignatureHelp(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Promise<SignatureHelp | null> {
    const theCall = this.walkBackwardsToBeginningOfCall(document, position);
    if (theCall == null) {
      return Promise.resolve(null);
    }
    const callerPos = this.previousTokenPosition(document, theCall.openParen);
    if (!callerPos) {
      return null;
    }
    const callerToken = document.getText(
      document.getWordRangeAtPosition(callerPos)
    );
    try {
      const signatures = this._functionTokenList.filter(
        item => item.name === callerToken
      );
      if (!signatures.length) {
        const importReg = /(import\s*){([^{}]*)}\s*from\s*(?:(?:'(.*)'|"(.*)"))/g;
        const content = document.getText();
        let execResult: Nullable<RegExpExecArray> = null;
        while ((execResult = importReg.exec(content))) {
          const [, , , pathAlias] = execResult;
          if (this._importAliasPathList.indexOf(pathAlias) === -1) {
            // this.recollectDeppendencies(document);
            eventBus.emit('recollect', document)
            break;
          }
        }
        return null;
      }
      const result = new SignatureHelp();
      let si: SignatureInformation[] = signatures.map(item => {
        const parameters = (item.parameters || []).map(parameter => `${parameter.name}${parameter.optional ? '?' : ''}: ${parameter.type}`)
        const info: SignatureInformation = {
          documentation: item.documentation,
          label: `${item.name} (${parameters.join(', ')}): ${item.returnType}`,
          parameters: parameters.map(p => new ParameterInformation(p))
        };
        return info;
      });

      result.signatures = si;
      result.activeSignature = 0;
      result.activeParameter = Math.min(
        theCall.commas.length,
        si[0].parameters.length - 1
      );
      return result;
    } catch (e) {
      return null;
    }
  }
  private previousTokenPosition(
    document: TextDocument,
    position: Position
  ): Position | null {
    while (position.character > 0) {
      const word = document.getWordRangeAtPosition(position);
      if (word) {
        return word.start;
      }
      position = position.translate(0, -1);
    }
    return null;
  }

  /**
   * Goes through the function params' lines and gets the number of commas and the start position of the call.
   */
  private walkBackwardsToBeginningOfCall(
    document: TextDocument,
    position: Position
  ): { openParen: Position; commas: Position[] } | null {
    let parenBalance = 0;
    let maxLookupLines = 30;
    const commas = [];

    for (
      let lineNr = position.line;
      lineNr >= 0 && maxLookupLines >= 0;
      lineNr--, maxLookupLines--
    ) {
      const line = document.lineAt(lineNr);

      // Stop processing if we're inside a comment
      // if (isPositionInComment(document, position)) {
      //   return null;
      // }

      // if its current line, get the text until the position given, otherwise get the full line.
      const [currentLine, characterPosition] =
        lineNr === position.line
          ? [line.text.substring(0, position.character), position.character]
          : [line.text, line.text.length - 1];

      for (let char = characterPosition; char >= 0; char--) {
        switch (currentLine[char]) {
          case '(':
            parenBalance--;
            if (parenBalance < 0) {
              return {
                openParen: new Position(lineNr, char),
                commas
              };
            }
            break;
          case ')':
            parenBalance++;
            break;
          case ',':
            const commaPos = new Position(lineNr, char);
            // if (parenBalance === 0 && !isPositionInString(document, commaPos)) {
            //   commas.push(commaPos);
            // }
            if (parenBalance === 0) {
              commas.push(commaPos);
            }
            break;
        }
      }
    }
    return null;
  }
}
