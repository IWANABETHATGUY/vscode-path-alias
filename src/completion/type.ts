export interface AliasMap {
  [prop: string]: string;
}

export interface StatInfo {
  type: 'file' | 'directory';
  children: { [name: string]: StatInfo };
  name: string;
  absolutePath: string;
}
