import {LineAndCharacter} from 'typescript';

export type ConfigPaths = {configPath:string, projectDir:string}[];
export type Alias = {
  webpackAlias: {
    [aliasProp: string]: string;
  },
  rollupAlias: {name: string, rollupAliasFunction: Function}[];
}

export type RollupAlias = {name: string, rollupAliasFunction: any}[];
export type WebpackAlias = {
  [aliasProp: string]: string;
};

export interface IExportToken {
  identifier: string;
  description?: string;
  params?: string[];
  position: LineAndCharacter;
  kind: 'function' | 'variable';
}