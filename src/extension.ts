'use strict';
import {
  ExtensionContext,
  commands,
  window,
  languages,
  workspace
} from 'vscode';
import { PathAliasCompletion } from './completion/index';
import { resolve } from 'path';

const triggerWord = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM'.split(
  ''
);
export function activate(context: ExtensionContext) {
  console.log('Congratulations, your extension "path-alias" is now active!');

  let disposable = commands.registerCommand('extension.sayHello', () => {
    window.showInformationMessage('Hello World!');
  });
  context.subscriptions.push(disposable);
  const absolutePath = resolve(workspace.rootPath || '');
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      [
        { language: 'javascript', scheme: 'file' },
        { language: 'vue', scheme: 'file' }
      ],
      new PathAliasCompletion({ '@': absolutePath || '' }),
      '/'
    )
  );
}

export function deactivate() {}
