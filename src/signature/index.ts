import {
  SignatureHelpProvider,
  SignatureHelp,
  TextDocument,
  Position,
  CancellationToken,
  Disposable,
  window,
  SignatureInformation,
  ParameterInformation
} from 'vscode';
import { Nullable } from '../util/types';
import { AliasStatTree } from '../completion/type';
import { mostLikeAlias, normalizePath } from '../util/common';
import * as fs from 'fs';
import * as path from 'path';
import { IFunctionSignature, getFuncitonSignatureFromFiles } from '../util/getSignatureFromFile';
// import { definitionLocation } from './goDeclaration';
// import {
//   getParametersAndReturnType,
//   isPositionInString,
//   isPositionInComment
// } from './util';
export interface SignatureHelpMap {
  id: string;
  [prop: string]: string[] | string;
}

export class PathAliasSignatureHelpProvider implements SignatureHelpProvider {
  private _disposable: Disposable;
  private _statMap!: AliasStatTree;
  private _aliasList: string[] = [];
  private _functionTokenList: IFunctionSignature[] = [];
  private _aliasPathList: string[] = [];
  private _absolutePathList: string[] = [];
  constructor(statMap: AliasStatTree) {
    const subscriptions: Disposable[] = [];
    this.setStatMap(statMap);
    window.onDidChangeActiveTextEditor(event => {
      if (event) {
        this.recollectDeppendencies(event.document);
      }
    });
    this._disposable = Disposable.from(...subscriptions);
  }

  setStatMap(statMap: AliasStatTree) {
    this._statMap = statMap;
    this._aliasList = Object.keys(this._statMap).sort();
  }
  dispose() {
    this._disposable.dispose();
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
          if (this._aliasPathList.indexOf(pathAlias) === -1) {
            this.recollectDeppendencies(document);
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
    // try {
    //   let declarationText: string = (res.declarationlines || [])
    //     .join(' ')
    //     .trim();
    //   if (!declarationText) {
    //     return null;
    //   }
    //   const result = new SignatureHelp();
    //   let sig: string;
    //   let si: SignatureInformation;
    //   if (res.toolUsed === 'godef') {
    //     // declaration is of the form "Add func(a int, b int) int"
    //     const nameEnd = declarationText.indexOf(' ');
    //     const sigStart = nameEnd + 5; // ' func'
    //     const funcName = declarationText.substring(0, nameEnd);
    //     sig = declarationText.substring(sigStart);
    //     si = new SignatureInformation(funcName + sig, res.doc);
    //   } else if (res.toolUsed === 'gogetdoc') {
    //     // declaration is of the form "func Add(a int, b int) int"
    //     declarationText = declarationText.substring(5);
    //     const funcNameStart = declarationText.indexOf(res.name + '('); // Find 'functionname(' to remove anything before it
    //     if (funcNameStart > 0) {
    //       declarationText = declarationText.substring(funcNameStart);
    //     }
    //     si = new SignatureInformation(declarationText, res.doc);
    //     sig = declarationText.substring(res.name.length);
    //   }
    //   si.parameters = getParametersAndReturnType(sig).params.map(
    //     paramText => new ParameterInformation(paramText)
    //   );
    //   result.signatures = [si];
    //   result.activeSignature = 0;
    //   result.activeParameter = Math.min(
    //     theCall.commas.length,
    //     si.parameters.length - 1
    //   );
    //   return result;
    // } catch (e) {
    //   return null;
    // }
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
