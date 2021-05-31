'use strict';
import { ExtensionContext } from 'vscode';
import { PathAlias } from './index';
export function activate(context: ExtensionContext) {
  new PathAlias(context);
}

export function deactivate() {}
