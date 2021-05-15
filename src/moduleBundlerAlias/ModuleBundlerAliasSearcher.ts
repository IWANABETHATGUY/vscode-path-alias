import {ConfigPaths, Alias, RollupAlias, WebpackAlias} from './types';

/**
 * 自动寻找 ModuleBundler alias 算法
 * forked from https://github.com/wanfu920/jumpToAliasFile
 *
 * 1. 确定当前工作目录使用到了 webpack
 *
 * 先寻找项目目录中 package.json
 *  仅搜寻当前目录和次级目录下的 package.json
 * 遍历 package.json 中的 script, 找出 webpack 命令使用到的 config 文件
 * 如果没有找到 webpack config 文件, 启用搜寻当前目录下的所有 webpack 开发的文件, 提取出 alias
 */

export abstract class ModuleBundlerAliasSearcher {
  protected abstract _projects: Map<string, { pkg: any }>;
  // protected readonly _workspaceDir: string
  constructor(protected readonly _workspaceDir: string) {

  }
  protected abstract _setProject(packageJsonPath: string): void;
  protected abstract _getConfigs(configPaths: ConfigPaths): void;
  public abstract getDefaultAlias(): Alias | RollupAlias | WebpackAlias;
  protected abstract _getConfigPathsFromPackage(): ConfigPaths;
  protected abstract _getConfigPathsFromScript(script: string, projectDir: string): string;
  protected abstract _getAliasFromModuleBundlerConfigs(moduleBundlerConfigs: any[]): Alias | RollupAlias | WebpackAlias;
  protected abstract _getConfigsFromFileSearch(): ConfigPaths;
  protected abstract _traverseGetModuleBundlerConfigsFromFileSearch(filePath: string, deep: number, maxDeep: number): any;
  protected abstract _getConfigPathFromFilePath(filePath: string): string;

}