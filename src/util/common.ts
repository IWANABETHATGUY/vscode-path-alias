import { StatInfo } from "../completion/type";

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
export function mostLikeAlias(aliasList: string[], path: string) : string{
  let index = -1;
  aliasList.forEach((curAlias, i) => {
    if (path === curAlias) {
      index = i;
    }
  })
  return index !== -1 ? aliasList[index] : '';
}


export function debounce(fn: Function, timeout: number, ctx?: any) {
  let timer: NodeJS.Timer;
  return function(...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.call(ctx, ...args)
    }, timeout)
  }
}