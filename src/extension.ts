'use strict';
import {
  ExtensionContext,
} from 'vscode';
import {PathAlias} from './index'
export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "path-alias" is now active!');
  new PathAlias(context);

}

export function deactivate() {}
