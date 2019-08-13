import { StatInfo } from "../completion/type";

export function isObject(obj: any): obj is StatInfo {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
