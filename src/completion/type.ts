export type AliasMap = Record<string, string>;

export interface StatInfo {
  type: 'file' | 'directory';
  children: AliasStatTree;
  name: string;
  absolutePath: string;
}

export type AliasStatTree  = Record<string, StatInfo>;
