import { StatInfo } from '../completion/type';
import * as path from 'path';
import * as fs from 'fs';
import { Uri, workspace } from 'vscode';
export function isObject(obj: any): obj is StatInfo {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * 寻找一个最近似的alias，例如有如下alias列表['@', '@src'], 有一个输入是'@src/teste/test', 这时候应该返回`@src`
 *
 * @export
 * @param {string[]} aliasList
 * @param {string} path
 * @returns {string}
 */
export function mostLikeAlias(aliasList: string[], path: string): string {
  let index = -1;
  aliasList.forEach((curAlias, i) => {
    if (path === curAlias) {
      index = i;
    }
  });
  return index !== -1 ? aliasList[index] : '';
}

export function debounce(fn: Function, timeout: number, ctx?: any) {
  let timer: NodeJS.Timer;
  return function(...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.call(ctx, ...args);
    }, timeout);
  };
}

/**
 *
 * 规范化一个路径，当省略某个目录下的index文件时会默认添加
 * @export
 * @param {string} absolutePath
 */
export function normalizePath(absolutePath: string) {
  if (fs.existsSync(absolutePath)) {
    if (fs.statSync(absolutePath).isDirectory()) {
      const indexFile = path.join(absolutePath, 'index.js');
      if (fs.existsSync(indexFile)) {
        absolutePath = indexFile;
      }
    }
  }
  return absolutePath;
}

/**
 * 将驼峰风格的变量转化为Pascal风格
 *
 * @export
 * @param {string} str
 * @returns {string}
 */
export function transformCamelToPascal(str: string): string {
  let last = 0;
  let i = 0;
  let retList = [];
  while (i < str.length) {
    if (isUpperCase(str[i])) {
      retList.push(str.slice(last, i));
      last = i;
    }
    i++;
  }
  retList.push(str.slice(last, i));
  return retList
    .filter(Boolean)
    .map(item => {
      return item[0].toUpperCase() + item.slice(1);
    })
    .join('');
}

/**
 * 将使用短横线连接的变量转化为Pascal风格的变量
 *
 * @export
 * @param {string} str
 * @returns {string}
 */
export function transformHyphenToPascal(str: string): string {
  let last = 0;
  let i = 0;
  let retList = [];
  while (i < str.length) {
    if (str[i] === '-') {
      retList.push(str.slice(last, i));
      last = i + 1;
    }
    i++;
  }
  retList.push(str.slice(last, i));
  return retList
    .filter(Boolean)
    .map(item => {
      return item[0].toUpperCase() + item.slice(1);
    })
    .join('');
}

function isUpperCase(char: string): boolean {
  return char >= 'A' && char <= 'Z';
}

/**
 * 返回给定的uri属于的workspaceFolder 索引
 *
 * @export
 * @param {Uri} uri
 * @returns {(number | undefined)}
 */
export function getIndexOfWorkspaceFolder(uri: Uri): number | undefined {
  const ws = workspace.getWorkspaceFolder(uri);
  if (ws) {
    return ws.index;
  }
  return undefined;
}

const extensions = ['.js', '.ts', '.jsx', '.tsx', '.vue'];
/**
 * 根据路径，自动补全文件的绝对路径
 * @param filePath 文件路径
 * @returns 
 */
export function getFileAbsolutePath(filePath: string, exts: string[] = extensions) {
  const fn = getFileWithExt(filePath, exts);
  if (fn) return fn;
  // 判断以其为名的目录下的index文件有无
  for(let ext of exts) {
    const indexFile = filePath + '/index' + ext;
    if (fs.existsSync(indexFile)) {
      return indexFile;
    }
  }
}

/**
 * 获取文件名包，或者含扩展文件有无
 * @param filePath 文件名
 * @param exts 匹配扩展列表
 * @returns 
 */
export function getFileWithExt(filePath: string, exts: string[] = extensions) {
  // 判断是否存在并且是否是文件
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  // 判断以其为名字，以ext为扩展的文件有无
  for(let ext of exts) {
    const sameNameFile = filePath + ext;
    if (fs.existsSync(sameNameFile) && fs.statSync(sameNameFile).isFile()) {
      return sameNameFile;
    }
  }
}