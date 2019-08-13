import { StatInfo } from "../completion/type";

export function isObject(obj: any): obj is StatInfo {
  return Object.prototype.toString.call(obj) === '[object Object]';
}


export function mostLikeAlias(aliasList: string[], path: string) : string{
  let index = -1;
  aliasList.forEach((curAlias, i) => {
    if (path.startsWith(curAlias)) {
      index = i;
    }
  })
  return index !== -1 ? aliasList[index] : '';
}